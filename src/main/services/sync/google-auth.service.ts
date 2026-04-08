import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { app, shell } from 'electron';
import { getAppDataDir } from '@main/lib/app-paths';
import { OAuth2Client, type Credentials } from 'google-auth-library';
import { oauth2 } from '@googleapis/oauth2';
import log from 'electron-log';
import { authResultPage } from './auth-result-page';

const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.appdata',
];
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;
const tokenPersistenceBoundClients = new WeakSet<OAuth2Client>();

/**
 * Detect auth-related refresh errors (revoked token, expired grant, etc.)
 */
function isRefreshAuthError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
        msg.includes('invalid_grant') ||
        msg.includes('token has been expired or revoked') ||
        msg.includes('invalid credentials') ||
        msg.includes('invalid authentication credentials') ||
        msg.includes('unauthorized')
    );
}

function getCredentialsPath(): string {
    if (app.isPackaged) {
        return join(
            process.resourcesPath,
            'credentials',
            'google',
            'google-drive-credentials.json',
        );
    }
    return join(app.getAppPath(), 'resources/credentials/google/google-drive-credentials.json');
}

function getTokenPath(): string {
    return join(getAppDataDir(), 'google-client-token.json');
}

function readSavedToken(tokenPath: string): Credentials | null {
    try {
        if (!existsSync(tokenPath)) return null;
        return JSON.parse(readFileSync(tokenPath, 'utf-8')) as Credentials;
    } catch (err) {
        log.warn('Failed to read saved Google token:', err);
        return null;
    }
}

function writeToken(tokenPath: string, token: Credentials): void {
    writeFileSync(tokenPath, JSON.stringify(token));
}

function mergeTokenState(
    savedToken: Credentials | null,
    currentCredentials: Credentials,
    incomingToken: Credentials,
): Credentials {
    const merged = {
        ...(savedToken ?? {}),
        ...currentCredentials,
        ...incomingToken,
    };

    if (!merged.refresh_token) {
        merged.refresh_token = currentCredentials.refresh_token ?? savedToken?.refresh_token;
    }

    return merged;
}

function bindTokenPersistence(client: OAuth2Client, tokenPath = getTokenPath()): void {
    if (tokenPersistenceBoundClients.has(client)) return;
    tokenPersistenceBoundClients.add(client);

    client.on('tokens', (tokens) => {
        const mergedToken = mergeTokenState(
            readSavedToken(tokenPath),
            client.credentials,
            tokens as Credentials,
        );
        writeToken(tokenPath, mergedToken);
        log.debug('Google auth token updated and saved');
    });
}

function loadCredentials(): { client_id: string; client_secret: string; redirect_uris: string[] } {
    const credPath = getCredentialsPath();
    if (!existsSync(credPath)) {
        throw new Error(`Google credentials not found at ${credPath}`);
    }
    const raw = JSON.parse(readFileSync(credPath, 'utf-8'));
    return raw.installed || raw.web;
}

function createOAuth2Client(
    credentials: ReturnType<typeof loadCredentials>,
    redirectUri: string,
): OAuth2Client {
    return new OAuth2Client(credentials.client_id, credentials.client_secret, redirectUri);
}

/**
 * Check if a saved token file exists.
 */
export function hasCredentials(): boolean {
    return existsSync(getTokenPath());
}

/**
 * Try to restore an authenticated OAuth2Client from the saved token.
 * Proactively refreshes expired tokens and saves the updated token.
 * Compares access tokens to detect refresh and persists the new token.
 */
export async function getExistingClient(): Promise<OAuth2Client | null> {
    const tokenPath = getTokenPath();
    if (!existsSync(tokenPath)) return null;

    try {
        const credentials = loadCredentials();
        const client = createOAuth2Client(credentials, 'http://localhost');
        const token = readSavedToken(tokenPath);
        if (!token) return null;

        bindTokenPersistence(client, tokenPath);
        client.setCredentials(token);

        // Proactively refresh if the access token is missing or near expiry.
        try {
            await refreshAccessTokenIfNeeded(client);
        } catch (refreshErr) {
            // If the error is an auth error (revoked, expired grant), clean up
            const error = refreshErr instanceof Error ? refreshErr : new Error(String(refreshErr));
            if (isRefreshAuthError(error)) {
                log.warn('Token refresh failed with auth error — removing saved token');
                try {
                    unlinkSync(tokenPath);
                } catch {
                    // ignore cleanup errors
                }
                return null;
            }
            // Offline or transient failure — return client with existing token.
            // The scheduler checks connectivity before each sync cycle.
            log.debug('Token refresh skipped (offline or transient), using saved token');
        }

        return client;
    } catch (err) {
        log.warn('Failed to restore Google auth token:', err);
        return null;
    }
}

/**
 * Revoke the Google OAuth token and delete the saved token file.
 * Best-effort: token revocation failure does not prevent local cleanup.
 */
export async function revokeAndDeleteToken(): Promise<void> {
    const tokenPath = getTokenPath();

    // Try to revoke the token with Google
    try {
        if (existsSync(tokenPath)) {
            const credentials = loadCredentials();
            const client = createOAuth2Client(credentials, 'http://localhost');
            const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
            client.setCredentials(token);

            const revokeToken = token.access_token || token.refresh_token;
            if (revokeToken) {
                await client.revokeToken(revokeToken);
                log.info('Google OAuth token revoked');
            }
        }
    } catch (err) {
        log.warn('Failed to revoke Google token (continuing with local cleanup):', err);
    }

    // Always delete the local token file
    try {
        if (existsSync(tokenPath)) {
            unlinkSync(tokenPath);
            log.info('Google token file deleted');
        }
    } catch (err) {
        log.warn('Failed to delete token file:', err);
    }
}

export async function refreshAccessTokenIfNeeded(client: OAuth2Client): Promise<void> {
    const { access_token, refresh_token, expiry_date } = client.credentials;
    if (!refresh_token) return;

    const expiresSoon =
        typeof expiry_date !== 'number' || expiry_date <= Date.now() + TOKEN_REFRESH_BUFFER_MS;

    if (!access_token || expiresSoon) {
        const refreshed = await client.getAccessToken();
        if (!refreshed.token) {
            throw new Error('Could not refresh access token');
        }
    }
}

/**
 * Verify that the token includes all required scopes.
 * Ensures no required scopes were denied by the user.
 */
function verifyScopes(scopeString: string | undefined): void {
    if (!scopeString) {
        throw new Error('No scopes returned in token response');
    }

    const grantedScopes = new Set(scopeString.split(' '));
    const missingScopes = SCOPES.filter((s) => !grantedScopes.has(s));

    if (missingScopes.length > 0) {
        throw new Error(`Authorization incomplete: missing scopes: ${missingScopes.join(', ')}`);
    }
}

/**
 * Full OAuth2 login flow: opens browser, listens for callback, exchanges code.
 * Includes scope verification after token exchange.
 */
export async function authenticateWithGoogle(): Promise<{
    client: OAuth2Client;
    userInfo: { email: string; name: string };
}> {
    const credentials = loadCredentials();
    const tokenPath = getTokenPath();

    // Start local HTTP server to receive the OAuth callback
    const { port, codePromise, server } = await startAuthServer();

    try {
        const redirectUri = `http://localhost:${port}`;
        const client = createOAuth2Client(credentials, redirectUri);
        bindTokenPersistence(client, tokenPath);

        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
        });

        // Open browser for user to authorize
        await shell.openExternal(authUrl);

        // Wait for the callback (3 minute timeout)
        const code = await Promise.race([
            codePromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('OAuth timeout')), 3 * 60_000),
            ),
        ]);

        // Exchange code for tokens
        const { tokens } = await client.getToken(code);

        // Verify scopes before saving
        verifyScopes(tokens.scope ?? undefined);

        client.setCredentials(tokens);

        // Save token for future sessions
        writeToken(
            tokenPath,
            mergeTokenState(readSavedToken(tokenPath), client.credentials, tokens),
        );

        // Fetch user info
        const oauth2Client = oauth2({ auth: client, version: 'v2' });
        const { data } = await oauth2Client.userinfo.get();

        return {
            client,
            userInfo: {
                email: data.email ?? '',
                name: data.name ?? '',
            },
        };
    } finally {
        server.close();
    }
}

function startAuthServer(): Promise<{
    port: number;
    codePromise: Promise<string>;
    server: Server;
}> {
    return new Promise((resolve, reject) => {
        let resolveCode: (code: string) => void;
        const codePromise = new Promise<string>((res) => {
            resolveCode = res;
        });

        const server = createServer((req, res) => {
            const url = new URL(req.url ?? '/', `http://localhost`);
            const code = url.searchParams.get('code');
            const errorParam = url.searchParams.get('error');

            if (errorParam) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(authResultPage(false));
                return;
            }

            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(authResultPage(true));
                resolveCode(code);
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(authResultPage(false));
            }
        });

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr === 'object') {
                resolve({ port: addr.port, codePromise, server });
            } else {
                reject(new Error('Failed to start auth server'));
            }
        });

        server.on('error', reject);
    });
}
