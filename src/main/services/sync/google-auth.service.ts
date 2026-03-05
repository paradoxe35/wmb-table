import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { app, shell } from 'electron';
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
    return join(
        __dirname,
        '../../../../resources/credentials/google/google-drive-credentials.json',
    );
}

function getTokenPath(): string {
    return join(app.getPath('userData'), 'google-client-token.json');
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
 * Returns null if no token exists.
 */
export async function getExistingClient(): Promise<OAuth2Client | null> {
    const tokenPath = getTokenPath();
    if (!existsSync(tokenPath)) return null;

    try {
        const credentials = loadCredentials();
        const client = createOAuth2Client(credentials, 'http://localhost');
        const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
        client.setCredentials(token);
        return client;
    } catch (err) {
        log.warn('Failed to restore Google auth token:', err);
        return null;
    }
}

/**
 * Full OAuth2 login flow: opens browser, listens for callback, exchanges code.
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

            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(
                    '<html><body><h2>Connexion r\u00e9ussie ! Vous pouvez fermer cette fen\u00eatre.</h2></body></html>',
                );
                resolveCode(code);
            } else {
                res.writeHead(400);
                res.end('Missing code parameter');
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
