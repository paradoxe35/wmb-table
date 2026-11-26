import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildMcpUrl } from '@shared/mcp.types';
import type { AppProcess } from './driver/app-process';
import { holdPort } from './mcp-server-checks';

export interface McpCliCheckContext {
    repoRoot: string;
    app: AppProcess;
    languageCode: string;
    check(label: string, passed: boolean, details?: unknown): void;
}

interface CliRun {
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

const WRITE_TOOLS = ['createNote', 'editNote', 'createSubject', 'removeSubjectReference'];
const CLI_TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parentOf(pid: string): string | null {
    try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
        return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1];
    } catch {
        return null;
    }
}

/** The process and everything it started (Chromium's zygotes, GPU and utility processes). */
function processTree(root: number): number[] {
    const parents = new Map(
        readdirSync('/proc')
            .filter((name) => /^\d+$/.test(name))
            .map((pid) => [pid, parentOf(pid)] as const),
    );
    const tree = [String(root)];
    for (let i = 0; i < tree.length; i++) {
        for (const [pid, parent] of parents) if (parent === tree[i]) tree.push(pid);
    }
    return tree.map(Number);
}

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return !readFileSync(`/proc/${pid}/stat`, 'utf8').includes(') Z ');
    } catch {
        return false;
    }
}

async function allGone(pids: number[]): Promise<boolean> {
    for (let i = 0; i < 100; i++) {
        if (!pids.some(isAlive)) return true;
        await sleep(100);
    }
    return false;
}

function firstText(result: { content?: unknown }): string {
    const [content] = (result.content ?? []) as { text?: string }[];
    return content?.text ?? '';
}

/**
 * Runs the built app as `wmb-table mcp` the way an AI app does: same profile as the GUI,
 * no display at all, talking MCP over the process pipes or the headless HTTP server.
 */
export class McpCliChecks {
    private readonly ctx: McpCliCheckContext;

    constructor(ctx: McpCliCheckContext) {
        this.ctx = ctx;
    }

    private get electron(): string {
        return join(this.ctx.repoRoot, 'node_modules/electron/dist/electron');
    }

    /** No DISPLAY or WAYLAND_DISPLAY: the command must start without any display server. */
    private env(): Record<string, string> {
        const env: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined && key !== 'DISPLAY' && key !== 'WAYLAND_DISPLAY') {
                env[key] = value;
            }
        }
        return { ...env, HOME: this.ctx.app.homeDir, XDG_CONFIG_HOME: this.ctx.app.configDir };
    }

    private async withStdioClient<T>(
        args: string[],
        run: (client: Client) => Promise<T>,
    ): Promise<{ value: T; stderr: string }> {
        const transport = new StdioClientTransport({
            command: this.electron,
            args: ['.', 'mcp', ...args],
            cwd: this.ctx.repoRoot,
            env: this.env(),
            stderr: 'pipe',
        });
        let stderr = '';
        transport.stderr?.on('data', (data) => (stderr += data));
        const client = new Client({ name: 'wmb-table-cli-e2e', version: '1.0.0' });
        await client.connect(transport);
        const tree = processTree(transport.pid ?? -1);
        try {
            return { value: await run(client, transport), stderr };
        } finally {
            await client.close();
            this.ctx.check(
                'closing stdin stops the command and every process it started',
                await allGone(tree),
                { tree: tree.filter(isAlive), stderr: stderr.slice(-800) },
            );
        }
    }

    private runCommand(
        command: string,
        args: string[],
        env?: Record<string, string>,
    ): Promise<CliRun> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd: this.ctx.repoRoot, env: env ?? process.env });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => (stdout += data));
            child.stderr.on('data', (data) => (stderr += data));
            child.stdin.end();
            const timer = setTimeout(() => child.kill('SIGKILL'), CLI_TIMEOUT_MS);
            child.on('error', reject);
            child.on('exit', (code, signal) => {
                clearTimeout(timer);
                resolve({ code, signal, stdout, stderr });
            });
        });
    }

    private runCli(args: string[]): Promise<CliRun> {
        return this.runCommand(this.electron, ['.', 'mcp', ...args], this.env());
    }

    private async readSession(client: Client, label: string): Promise<string[]> {
        const { check } = this.ctx;
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        check(`${label}: the read tools are listed`, names.includes('searchSermons'), names);

        const search = await client.callTool({
            name: 'searchSermons',
            arguments: { query: '1963' },
        });
        const parsed = JSON.parse(firstText(search) || '{}') as { results?: unknown[] };
        check(
            `${label}: a sermon search returns results from the installed pack`,
            !search.isError && (parsed.results?.length ?? 0) > 0,
            firstText(search).slice(0, 300),
        );

        const passage = await client.callTool({
            name: 'getBiblePassage',
            arguments: {
                bookCode: 'Jean',
                chapter: '3',
                fromVerse: '16',
                toVerse: '16',
                languageCode: 'fr',
            },
        });
        check(
            `${label}: a Bible passage is returned`,
            !passage.isError && firstText(passage).includes('Dieu'),
            firstText(passage).slice(0, 300),
        );
        return names;
    }

    private async writeRefused(client: Client, names: string[], label: string): Promise<void> {
        const outcome = await client
            .callTool({ name: 'createNote', arguments: { name: 'CLI refused', content: 'x' } })
            .then((result) => Boolean(result.isError))
            .catch(() => true);
        this.ctx.check(
            `${label}: writes are hidden and refused while changes are off`,
            outcome && !names.some((name) => WRITE_TOOLS.includes(name)),
            names,
        );
    }

    /** While the window is open on the same profile: both answer, nothing conflicts. */
    async whileGuiRuns(
        readNoteNames: () => Promise<string[]>,
        setAllowWrites: (on: boolean) => Promise<void>,
    ): Promise<void> {
        console.log('MCP CLI: while the app is open');
        const { check } = this.ctx;
        const readOnly = await this.withStdioClient([], async (client) => {
            const names = await this.readSession(client, 'stdio with the app open');
            await this.writeRefused(client, names, 'stdio with the app open');
            return names;
        });
        check(
            'the command writes nothing but MCP on stdout and starts without a display',
            readOnly.value.length > 0,
            readOnly.stderr.slice(-800),
        );

        await setAllowWrites(true);
        const noteName = "Note CLI : l'amour du Saint-Esprit";
        await this.withStdioClient([], async (client) => {
            const names = (await client.listTools()).tools.map((tool) => tool.name);
            check(
                'with changes allowed, the write tools are listed',
                WRITE_TOOLS.every((n) => names.includes(n)),
                names,
            );
            const result = await client.callTool({
                name: 'createNote',
                arguments: { name: noteName, content: 'Romains 5:5' },
            });
            check(
                'with changes allowed, the command creates a note',
                !result.isError,
                firstText(result),
            );
        });
        check(
            'the open app sees the note written by the command',
            (await readNoteNames()).includes(noteName),
        );
        await setAllowWrites(false);

        await this.headlessHttp('headless HTTP with the app open');
    }

    async headlessHttp(label: string): Promise<void> {
        const { check } = this.ctx;
        const port = await this.freePort();
        const child = spawn(this.electron, ['.', 'mcp', '--http', '--port', String(port)], {
            cwd: this.ctx.repoRoot,
            env: this.env(),
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => (stdout += data));
        child.stderr.on('data', (data) => (stderr += data));
        const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
            child.on('exit', (code, signal) => resolve({ code, signal })),
        );
        const url = buildMcpUrl(port);
        let tree: number[] = [];
        try {
            const deadline = Date.now() + CLI_TIMEOUT_MS;
            while (!stdout.includes(url) && Date.now() < deadline) await sleep(100);
            check(`${label}: prints its address`, stdout.includes(url), {
                stdout,
                stderr: stderr.slice(-800),
            });
            tree = processTree(child.pid ?? -1);
            const client = new Client({ name: 'wmb-table-cli-e2e', version: '1.0.0' });
            await client.connect(new StreamableHTTPClientTransport(new URL(url)));
            try {
                await this.readSession(client, label);
            } finally {
                await client.close();
            }
        } finally {
            child.kill('SIGTERM');
            const exit = await Promise.race([exited, sleep(10_000).then(() => null)]);
            check(`${label}: SIGTERM stops it cleanly`, exit?.code === 0 && (await allGone(tree)), {
                exit,
                stderr: stderr.slice(-800),
            });
            if (!exit) child.kill('SIGKILL');
        }
    }

    private async freePort(): Promise<number> {
        for (let port = 24_100; port < 24_200; port++) {
            const held = await holdPort(port);
            if (held) {
                await held.release();
                return port;
            }
        }
        throw new Error('No free port for the headless HTTP check');
    }

    /** With the window closed: refusals, then both modes alone, then the database is intact. */
    async withoutGui(): Promise<void> {
        console.log('MCP CLI: with the app closed');
        const { check } = this.ctx;
        this.setStoredSettings({ enabled: false, allowWrites: false });
        const disabled = await this.runCli([]);
        check(
            'with the server off in Settings, the command exits with code 1 and says how to turn it on',
            disabled.code === 1 &&
                disabled.stderr.includes(
                    'Activez « Serveur MCP » dans Wmb Table → Paramètres → Assistant',
                ) &&
                disabled.stdout === '',
            disabled,
        );

        const invalid = await this.runCli(['--nope']);
        check(
            'an unknown option exits with code 2 and the usage',
            invalid.code === 2 &&
                invalid.stderr.includes('Unknown option "--nope"') &&
                invalid.stderr.includes('Usage:'),
            invalid,
        );

        this.setStoredSettings({ enabled: true, allowWrites: false });
        const missingLanguage = await this.runCli(['--language', 'de']);
        check(
            'a language that is not installed is refused',
            missingLanguage.code === 1 && missingLanguage.stderr.includes('« de »'),
            missingLanguage,
        );

        await this.withStdioClient(['--language', this.ctx.languageCode], async (client) => {
            const names = await this.readSession(client, 'stdio alone');
            await this.writeRefused(client, names, 'stdio alone');
        });
        await this.headlessHttp('headless HTTP alone');
        check('the database is intact after both apps used it', this.integrityOk());
    }

    private databasePath(): string {
        return join(this.ctx.app.appDataDir, 'databases', 'wmb-table.sqlite');
    }

    private setStoredSettings(patch: { enabled: boolean; allowWrites: boolean }): void {
        const db = new DatabaseSync(this.databasePath());
        try {
            const row = db
                .prepare("SELECT value FROM kv_cache WHERE key = 'mcp-server-settings'")
                .get() as { value: string } | undefined;
            const value = { ...(row ? JSON.parse(row.value) : {}), ...patch };
            db.prepare(
                "INSERT OR REPLACE INTO kv_cache (key, value) VALUES ('mcp-server-settings', ?)",
            ).run(JSON.stringify(value));
        } finally {
            db.close();
        }
    }

    private integrityOk(): boolean {
        const db = new DatabaseSync(this.databasePath(), { readOnly: true });
        try {
            const row = db.prepare('PRAGMA integrity_check').get() as Record<string, string>;
            return Object.values(row)[0] === 'ok';
        } finally {
            db.close();
        }
    }
}
