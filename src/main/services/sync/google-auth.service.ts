import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { app, shell } from 'electron';
import { getAppDataDir } from '@main/lib/app-paths';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import log from 'electron-log';

const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.appdata',
];

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
    return new google.auth.OAuth2(credentials.client_id, credentials.client_secret, redirectUri);
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
        const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
        client.setCredentials(token);

        // Proactively refresh if needed and save updated token
        try {
            const refreshed = await client.getAccessToken();
            if (refreshed.token && refreshed.token !== token.access_token) {
                const updatedToken = client.credentials;
                writeFileSync(tokenPath, JSON.stringify(updatedToken));
                log.debug('Google auth token refreshed and saved');
            }
        } catch {
            // Offline or refresh failed — return client with existing token.
            // The scheduler checks connectivity before each sync cycle.
            log.debug('Token refresh skipped (offline or failed), using saved token');
        }

        return client;
    } catch (err) {
        log.warn('Failed to restore Google auth token:', err);
        return null;
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

    // Start local HTTP server to receive the OAuth callback
    const { port, codePromise, server } = await startAuthServer();

    try {
        const redirectUri = `http://localhost:${port}`;
        const client = createOAuth2Client(credentials, redirectUri);

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
        writeFileSync(getTokenPath(), JSON.stringify(tokens));

        // Fetch user info
        const oauth2 = google.oauth2({ auth: client, version: 'v2' });
        const { data } = await oauth2.userinfo.get();

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

function authResultPage(success: boolean): string {
    const title = success ? 'Connexion réussie' : 'Échec de la connexion';
    const message = success
        ? "Vous pouvez fermer cette fenêtre et retourner à l'application."
        : "L'autorisation a échoué. Veuillez réessayer depuis l'application.";
    const color = success ? '#52c41a' : '#ff4d4f';
    const icon = success ? '✓' : '✗';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #f5f5f5; color: #333;
        }
        .card {
            background: #fff; border-radius: 12px; padding: 48px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center;
            max-width: 420px;
        }
        .icon {
            width: 64px; height: 64px; border-radius: 50%;
            background: ${color}; color: #fff; font-size: 32px;
            display: inline-flex; align-items: center; justify-content: center;
            margin-bottom: 24px;
        }
        h1 { font-size: 22px; margin-bottom: 12px; }
        p { font-size: 15px; color: #666; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
    </div>
</body>
</html>`;
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
