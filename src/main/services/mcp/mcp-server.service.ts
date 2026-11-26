import { app } from 'electron';
import log from '@main/lib/logger';
import type {
    McpServerError,
    McpServerSettings,
    McpServerSettingsPatch,
    McpServerStatus,
} from '@shared/mcp.types';
import { createLibraryMcpServer } from './library-mcp-server';
import { NoFreePortError } from './listen-on-free-port';
import { startMcpHttpServer, type McpHttpServer } from './mcp-http-server';
import { loadMcpSettings, saveMcpSettings } from './mcp-settings';

interface RunningServer {
    http: McpHttpServer;
    allowWrites: boolean;
}

let running: RunningServer | null = null;
let lastError: McpServerError | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Toggles can arrive faster than a server starts, so changes apply one after another. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
}

export function getMcpServerStatus(): McpServerStatus {
    return { settings: loadMcpSettings(), url: running?.http.url ?? null, error: lastError };
}

export function startMcpServerIfEnabled(): Promise<McpServerStatus> {
    return serialized(async () => {
        await apply(loadMcpSettings());
        return getMcpServerStatus();
    });
}

export function updateMcpServerSettings(patch: McpServerSettingsPatch): Promise<McpServerStatus> {
    return serialized(async () => {
        const settings = { ...loadMcpSettings(), ...patch };
        saveMcpSettings(settings);
        await apply(settings);
        return getMcpServerStatus();
    });
}

export function stopMcpServer(): Promise<void> {
    return serialized(closeRunning);
}

async function apply(settings: McpServerSettings): Promise<void> {
    const unchanged = running && settings.enabled && running.allowWrites === settings.allowWrites;
    if (unchanged) return;

    await closeRunning();
    lastError = null;
    if (settings.enabled) await start(settings);
}

async function start(settings: McpServerSettings): Promise<void> {
    try {
        const http = await startMcpHttpServer({
            firstPort: settings.port,
            createServer: () =>
                createLibraryMcpServer({
                    allowWrites: settings.allowWrites,
                    version: app.getVersion(),
                }),
        });
        running = { http, allowWrites: settings.allowWrites };
        if (http.port !== settings.port) saveMcpSettings({ ...settings, port: http.port });
        log.info(
            `[mcp] Serving the library at ${http.url} (writes ${settings.allowWrites ? 'on' : 'off'})`,
        );
    } catch (error) {
        lastError = toServerError(error);
        log.error('[mcp] The server could not start:', error);
    }
}

function toServerError(error: unknown): McpServerError {
    if (error instanceof NoFreePortError) {
        return { code: 'no-free-port', firstPort: error.firstPort, lastPort: error.lastPort };
    }
    return { code: 'start-failed' };
}

async function closeRunning(): Promise<void> {
    const current = running;
    running = null;
    if (!current) return;
    await current.http.close();
    log.info('[mcp] Server stopped');
}
