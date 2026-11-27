import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { CdpSession } from './cdp';

export interface AppProcessOptions {
    repoRoot: string;
    /** Parent folder of the throwaway profile; it is created and removed by the app process. */
    profileParent: string;
    screen?: string;
    startTimeoutMs?: number;
}

interface PageTarget {
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
}

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

/**
 * The built app under Xvfb with a throwaway profile. HOME is replaced too, because the app
 * keeps its databases and sermon indexes in `~/.wmb-table`, outside XDG_CONFIG_HOME.
 */
export class AppProcess {
    readonly profileDir: string;
    readonly homeDir: string;
    readonly configDir: string;
    private child: ChildProcess | null = null;
    private output = '';
    private exit: { code: number | null; signal: string | null } | null = null;
    private readonly options: AppProcessOptions;

    constructor(options: AppProcessOptions) {
        this.options = options;
        mkdirSync(options.profileParent, { recursive: true });
        this.profileDir = mkdtempSync(join(options.profileParent, 'profile-'));
        this.homeDir = join(this.profileDir, 'home');
        this.configDir = join(this.profileDir, 'config');
        mkdirSync(this.homeDir, { recursive: true });
        mkdirSync(this.configDir, { recursive: true });
    }

    get appDataDir(): string {
        return join(this.homeDir, '.wmb-table');
    }

    async start(): Promise<CdpSession> {
        const { repoRoot } = this.options;
        if (!existsSync(join(repoRoot, 'out/main/index.js'))) {
            throw new Error('The app is not built. Run `pnpm build` first.');
        }
        const debugPort = await freePort();
        const electron = join(repoRoot, 'node_modules/.bin/electron');
        const screen = this.options.screen ?? '1440x900x24';
        this.child = spawn(
            'xvfb-run',
            [
                '-a',
                '-s',
                `-screen 0 ${screen}`,
                electron,
                '.',
                '--no-sandbox',
                `--remote-debugging-port=${debugPort}`,
            ],
            {
                cwd: repoRoot,
                detached: true,
                env: { ...process.env, HOME: this.homeDir, XDG_CONFIG_HOME: this.configDir },
            },
        );
        this.child.stdout?.on('data', (data) => (this.output += data));
        this.child.stderr?.on('data', (data) => (this.output += data));
        this.child.on('exit', (code, signal) => (this.exit = { code, signal }));
        const target = await this.waitForPage(debugPort);
        return CdpSession.connect(target.webSocketDebuggerUrl);
    }

    /** Process output plus the electron-log file, which holds the main-process log. */
    mainLog(): string {
        const logFile = join(this.configDir, 'Wmb Table', 'logs', 'main.log');
        const fileLog = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
        return `${this.output}\n--- ${logFile} ---\n${fileLog}`;
    }

    async stop(): Promise<void> {
        await this.killGroup();
        rmSync(this.profileDir, { recursive: true, force: true });
    }

    private async waitForPage(debugPort: number): Promise<PageTarget> {
        const deadline = Date.now() + (this.options.startTimeoutMs ?? 60_000);
        while (Date.now() < deadline) {
            if (this.exit) {
                throw new Error(
                    `App exited early (${JSON.stringify(this.exit)}):\n${this.output.slice(-2000)}`,
                );
            }
            const page = await this.findPage(debugPort);
            if (page) return page;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error(`No page target on port ${debugPort}:\n${this.output.slice(-2000)}`);
    }

    private async findPage(debugPort: number): Promise<PageTarget | undefined> {
        try {
            const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
            const targets = (await response.json()) as PageTarget[];
            return targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
        } catch {
            return undefined;
        }
    }

    private async killGroup(): Promise<void> {
        const pid = this.child?.pid;
        if (!pid || this.exit) return;
        const exited = new Promise<void>((resolve) => this.child?.once('exit', () => resolve()));
        const signalGroup = (signal: NodeJS.Signals) => {
            try {
                process.kill(-pid, signal);
            } catch {
                return;
            }
        };
        signalGroup('SIGTERM');
        const timeout = new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), 8000),
        );
        if ((await Promise.race([exited, timeout])) === 'timeout') signalGroup('SIGKILL');
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2000))]);
    }
}
