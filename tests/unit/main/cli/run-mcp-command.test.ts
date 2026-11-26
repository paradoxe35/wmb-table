import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoFreePortError } from '@main/services/mcp/listen-on-free-port';
import { DEFAULT_MCP_SERVER_SETTINGS, type McpServerSettings } from '@shared/mcp.types';

const calls = vi.hoisted(() => [] as string[]);
const state = vi.hoisted(() => ({
    settings: { enabled: true, allowWrites: false, port: 23132 } as McpServerSettings,
    installed: ['fr', 'en'],
    httpError: null as Error | null,
    exited: null as null | ((code: number) => void),
}));

vi.mock('electron', () => ({
    app: {
        getVersion: () => '2.0.0',
        whenReady: () => Promise.resolve(),
        on: vi.fn(),
        exit: (code: number) => {
            calls.push(`exit ${code}`);
            state.exited?.(code);
        },
        dock: { hide: () => calls.push('dock hidden') },
    },
}));
vi.mock('@main/database', () => ({
    initializeDatabase: () => calls.push('database opened'),
    closeDatabase: () => calls.push('database closed'),
}));
vi.mock('@main/database/repositories/config.repository', () => ({
    getConfig: () => ({ uiLanguage: 'en', contentLanguage: 'fr' }),
}));
vi.mock('@main/services/tantivy.service', () => ({
    initializeTantivy: async () => calls.push('indexes opened'),
    getInstalledLanguages: () => state.installed,
    terminateWorker: async () => calls.push('indexes closed'),
}));
vi.mock('@main/services/mcp/mcp-settings', () => ({ loadMcpSettings: () => state.settings }));
vi.mock('@main/services/mcp/library-mcp-server', () => ({
    createLibraryMcpServer: (options: unknown) => ({ options }),
}));
vi.mock('@main/services/mcp/mcp-http-server', () => ({
    startMcpHttpServer: vi.fn(async (options: { firstPort: number }) => {
        if (state.httpError) throw state.httpError;
        calls.push(`http started ${options.firstPort}`);
        return {
            url: `http://127.0.0.1:${options.firstPort}/mcp`,
            close: async () => calls.push('http closed'),
        };
    }),
}));
vi.mock('@modelcontextprotocol/server/stdio', () => ({
    StdioServerTransport: class {},
    serveStdio: vi.fn(() => {
        calls.push('stdio started');
        return { close: async () => calls.push('stdio closed') };
    }),
}));

const { runMcpCommand } = await import('@main/cli/run-mcp-command');
const { startMcpHttpServer } = await import('@main/services/mcp/mcp-http-server');
const { serveStdio } = await import('@modelcontextprotocol/server/stdio');

type Listener = () => void;
let processListeners: Map<string, Listener>;
let stdinListeners: Map<string, Listener>;
let stderr: string;
let stdout: string;

function run(command: Parameters<typeof runMcpCommand>[0]): Promise<number> {
    const exited = new Promise<number>((resolve) => (state.exited = resolve));
    runMcpCommand(command);
    return exited;
}

async function started(): Promise<void> {
    await vi.waitFor(() =>
        expect(calls.some((c) => c.endsWith('started') || c.startsWith('http started'))).toBe(true),
    );
}

beforeEach(() => {
    calls.length = 0;
    state.settings = { ...DEFAULT_MCP_SERVER_SETTINGS, enabled: true };
    state.installed = ['fr', 'en'];
    state.httpError = null;
    stderr = '';
    stdout = '';
    processListeners = new Map();
    stdinListeners = new Map();
    vi.spyOn(process, 'on').mockImplementation(((event: string, listener: Listener) => {
        processListeners.set(event, listener);
        return process;
    }) as typeof process.on);
    vi.spyOn(process.stdin, 'once').mockImplementation(((event: string, listener: Listener) => {
        stdinListeners.set(event, listener);
        return process.stdin;
    }) as typeof process.stdin.once);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderr += String(chunk);
        return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        stdout += String(chunk);
        return true;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(startMcpHttpServer).mockClear();
});

describe('wmb-table mcp', () => {
    it('refuses to start while the server is off in Settings, with exit code 1', async () => {
        state.settings = { ...DEFAULT_MCP_SERVER_SETTINGS, enabled: false };
        expect(await run({ kind: 'mcp', transport: 'stdio' })).toBe(1);
        expect(stderr).toContain('Turn on “MCP server” in Wmb Table → Settings → Assistant.');
        expect(calls).not.toContain('indexes opened');
        expect(calls).not.toContain('stdio started');
        expect(calls.at(-2)).toBe('database closed');
    });

    it('refuses a language that is not installed', async () => {
        expect(await run({ kind: 'mcp', transport: 'stdio', language: 'de' })).toBe(1);
        expect(stderr).toContain(
            'The language “de” is not installed in Wmb Table. Installed: fr, en.',
        );
        expect(calls).not.toContain('stdio started');
    });

    it('serves over stdio and stops cleanly when stdin closes', async () => {
        const exit = run({ kind: 'mcp', transport: 'stdio', language: 'en' });
        await started();
        expect(stdout).toBe('');
        stdinListeners.get('end')?.();
        expect(await exit).toBe(0);
        expect(calls).toEqual([
            'dock hidden',
            'database opened',
            'indexes opened',
            'stdio started',
            'stdio closed',
            'indexes closed',
            'database closed',
            'exit 0',
        ]);
    });

    it('builds each MCP server with the current write setting and the asked language', async () => {
        const exit = run({ kind: 'mcp', transport: 'stdio', language: 'en' });
        await started();
        const factory = vi.mocked(serveStdio).mock.calls.at(-1)?.[0] as () => {
            options: unknown;
        };
        state.settings = { ...state.settings, allowWrites: true };
        expect(factory().options).toEqual({
            allowWrites: true,
            version: '2.0.0',
            contentLanguage: 'en',
        });
        stdinListeners.get('close')?.();
        await exit;
    });

    it('serves over HTTP on the port from Settings, with the usual fallback', async () => {
        state.settings = { ...state.settings, port: 23135 };
        const exit = run({ kind: 'mcp', transport: 'http' });
        await started();
        expect(vi.mocked(startMcpHttpServer).mock.calls[0][0]).toMatchObject({
            firstPort: 23135,
            portAttempts: undefined,
        });
        expect(stdout).toContain('http://127.0.0.1:23135/mcp');
        processListeners.get('SIGTERM')?.();
        expect(await exit).toBe(0);
        expect(calls.slice(-4)).toEqual([
            'http closed',
            'indexes closed',
            'database closed',
            'exit 0',
        ]);
    });

    it('refuses HTTP requests once « Serveur MCP » is unticked, and serves again when ticked', async () => {
        const exit = run({ kind: 'mcp', transport: 'http' });
        await started();
        const { refusal } = vi.mocked(startMcpHttpServer).mock.calls[0][0] as {
            refusal: () => string | null;
        };
        expect(refusal()).toBeNull();
        state.settings = { ...state.settings, enabled: false };
        expect(refusal()).toContain('Turn on “MCP server” in Wmb Table → Settings → Assistant.');
        state.settings = { ...state.settings, enabled: true };
        expect(refusal()).toBeNull();
        processListeners.get('SIGTERM')?.();
        await exit;
    });

    it('ends a stdio session cleanly once « Serveur MCP » is unticked', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        try {
            const exit = run({ kind: 'mcp', transport: 'stdio' });
            await started();
            vi.advanceTimersByTime(2_000);
            expect(calls).not.toContain('stdio closed');

            state.settings = { ...state.settings, enabled: false };
            vi.advanceTimersByTime(2_000);
            expect(await exit).toBe(0);
            expect(stderr).toContain('Turn on “MCP server”');
            expect(calls.slice(-4)).toEqual([
                'stdio closed',
                'indexes closed',
                'database closed',
                'exit 0',
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses exactly the port asked for', async () => {
        const exit = run({ kind: 'mcp', transport: 'http', port: 24000 });
        await started();
        expect(vi.mocked(startMcpHttpServer).mock.calls[0][0]).toMatchObject({
            firstPort: 24000,
            portAttempts: 1,
        });
        processListeners.get('SIGINT')?.();
        expect(await exit).toBe(0);
    });

    it('explains a busy port and exits with code 1', async () => {
        state.httpError = new NoFreePortError(24000, 24000);
        expect(await run({ kind: 'mcp', transport: 'http', port: 24000 })).toBe(1);
        expect(stderr).toContain('Port 24000 is already in use');
        expect(calls.slice(-3)).toEqual(['indexes closed', 'database closed', 'exit 1']);
    });

    it('stops only once when several signals arrive', async () => {
        const exit = run({ kind: 'mcp', transport: 'http' });
        await started();
        processListeners.get('SIGTERM')?.();
        processListeners.get('SIGINT')?.();
        processListeners.get('SIGHUP')?.();
        await exit;
        expect(calls.filter((c) => c === 'database closed')).toHaveLength(1);
    });
});
