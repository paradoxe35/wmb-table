import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { McpClientStatus } from '@shared/mcp.types';
import type { AppProcess } from './driver/app-process';
import type { McpCheckContext } from './mcp-server-checks';

interface DesktopConfig {
    mcpServers: Record<string, { command: string; args: string[] }>;
    globalShortcut?: string;
}

const SETUP = '[data-testid="mcp-claude-desktop-setup"]';
const CONFIGURE = '[data-testid="mcp-claude-desktop-configure"]';
const OTHER_SERVER = { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] };
const EXISTING: DesktopConfig = {
    globalShortcut: 'Ctrl+Space',
    mcpServers: { filesystem: OTHER_SERVER },
};

const MALFORMED = '{"mcpServers": {';

type ShownState = McpClientStatus['state'] | 'outdated';

/**
 * Claude Desktop's folder lives under the app's XDG_CONFIG_HOME on Linux, so the throwaway
 * profile doubles as the fake Claude Desktop install.
 */
export class ClaudeDesktopChecks {
    private readonly ctx: McpCheckContext;
    private readonly app: AppProcess;
    private readonly dir: string;
    private readonly file: string;

    constructor(ctx: McpCheckContext, app: AppProcess) {
        this.ctx = ctx;
        this.app = app;
        this.dir = join(app.configDir, 'Claude');
        this.file = join(this.dir, 'claude_desktop_config.json');
    }

    async run(): Promise<void> {
        console.log('MCP: Claude Desktop auto-configure');
        for (const language of ['fr', 'en']) {
            await this.ctx.setUiLanguage(language);
            await this.ctx.reload();
            await this.stateShots(language);
        }
        await this.ctx.setUiLanguage('fr');
        await this.ctx.reload();
        await this.configureFlow();
        await this.connectWithWrittenConfig();
        rmSync(this.dir, { recursive: true, force: true });
    }

    private async showTab(): Promise<void> {
        await this.ctx.settings.openTab('ai');
        await this.ctx.cdp.waitFor(
            `Boolean(document.querySelector('${SETUP}'))`,
            'Claude Desktop setup',
            15_000,
        );
    }

    /** The page checks again when the window gets focus, as after installing Claude Desktop. */
    private async redetect(expected: ShownState): Promise<void> {
        const wanted = expected === 'outdated' ? 'configured' : expected;
        const outdatedCheck =
            expected === 'outdated'
                ? ` && Boolean(document.querySelector('${CONFIGURE}'))`
                : expected === 'configured'
                  ? ` && !document.querySelector('${CONFIGURE}')`
                  : '';
        await this.ctx.cdp.evaluate(`window.dispatchEvent(new Event('focus'))`);
        await this.ctx.cdp.waitFor(
            `document.querySelector('${SETUP}')?.dataset.state === '${wanted}'${outdatedCheck}`,
            `Claude Desktop ${expected}`,
            10_000,
        );
    }

    private async shot(name: string): Promise<void> {
        await this.ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 30 });
        await this.ctx.cdp.evaluate(
            `document.querySelector('${SETUP}').scrollIntoView({ block: 'center' })`,
        );
        await this.ctx.shot(name);
    }

    private arrange(state: ShownState): void {
        rmSync(this.dir, { recursive: true, force: true });
        if (state === 'not-installed') return;
        mkdirSync(this.dir, { recursive: true });
        if (state === 'not-configured') writeFileSync(this.file, JSON.stringify(EXISTING, null, 2));
        if (state === 'error') writeFileSync(this.file, MALFORMED);
        if (state === 'outdated') {
            writeFileSync(
                this.file,
                JSON.stringify({
                    mcpServers: { 'wmb-table': { command: '/old/wmb-table', args: ['mcp'] } },
                }),
            );
        }
    }

    private async stateShots(language: string): Promise<void> {
        await this.showTab();
        for (const state of ['not-installed', 'not-configured', 'outdated', 'error'] as const) {
            this.arrange(state);
            await this.redetect(state);
            await this.shot(`mcp-claude-desktop-${state}-${language}`);
        }
        this.arrange('not-configured');
        await this.redetect('not-configured');
        await this.ctx.settings.click(CONFIGURE);
        await this.redetect('configured');
        await this.shot(`mcp-claude-desktop-just-configured-${language}`);
        await this.ctx.reload();
        await this.showTab();
        await this.redetect('configured');
        await this.shot(`mcp-claude-desktop-configured-${language}`);
    }

    private readConfig(): DesktopConfig {
        return JSON.parse(readFileSync(this.file, 'utf8')) as DesktopConfig;
    }

    private backups(): string[] {
        return readdirSync(this.dir).filter((name) => name.includes('.wmb-table-backup-'));
    }

    private async configureFlow(): Promise<void> {
        const { check, cdp } = this.ctx;
        await this.showTab();

        this.arrange('not-installed');
        await this.redetect('not-installed');
        check(
            'Claude Desktop not installed: no button, a download link, nothing created',
            !(await cdp.evaluate<boolean>(`Boolean(document.querySelector('${CONFIGURE}'))`)) &&
                (await cdp.evaluate<boolean>(
                    `Boolean(document.querySelector('${SETUP} a[href="https://claude.ai/download"]'))`,
                )) &&
                !existsSync(this.dir),
        );

        this.arrange('error');
        await this.redetect('error');
        const errorText = await cdp.evaluate<string>(
            `document.querySelector('${SETUP}').innerText`,
        );
        check(
            'a malformed Claude Desktop file shows an error, no button, and is left as it was',
            errorText.includes('JSON valide') &&
                !errorText.includes('Configurer automatiquement') &&
                readFileSync(this.file, 'utf8') === MALFORMED &&
                this.backups().length === 0,
            errorText,
        );

        this.arrange('not-configured');
        await this.redetect('not-configured');
        await this.ctx.settings.click(CONFIGURE);
        await this.redetect('configured');
        const written = this.readConfig();
        const ours = written.mcpServers['wmb-table'];
        const status = await cdp.evaluate<{ launch: { command: string; args: string[] } }>(
            'window.api.mcp.getStatus()',
        );
        check(
            'Configurer automatiquement writes the command entry of this copy',
            ours?.command === status.launch.command &&
                ours.args.join(' ') === [...status.launch.args, '--no-sandbox', 'mcp'].join(' '),
            written,
        );
        check(
            'the other server and keys of Claude Desktop are kept',
            JSON.stringify(written.mcpServers.filesystem) === JSON.stringify(OTHER_SERVER) &&
                written.globalShortcut === 'Ctrl+Space',
            written,
        );
        const backups = this.backups();
        check(
            'a backup of the original file is made first',
            backups.length === 1 &&
                JSON.parse(readFileSync(join(this.dir, backups[0]), 'utf8')).globalShortcut ===
                    'Ctrl+Space',
            backups,
        );
        const restartHint = await cdp.evaluate<string>(
            `document.querySelector('${SETUP}').innerText`,
        );
        check(
            'the restart hint shows',
            restartHint.includes('Redémarrez Claude Desktop'),
            restartHint,
        );

        await this.ctx.reload();
        await this.showTab();
        await this.redetect('configured');
        const shown = await cdp.evaluate<string>(`document.querySelector('${SETUP}').innerText`);
        check(
            '« Déjà configuré » with no button afterwards',
            shown.includes('Déjà configuré'),
            shown,
        );

        await cdp.evaluate(`window.api.mcp.configureClient({ clientId: 'claude-desktop' })`);
        check('a second run writes nothing and makes no new backup', this.backups().length === 1);
    }

    /** Starts the server exactly as Claude Desktop would, from the file Wmb Table wrote. */
    private async connectWithWrittenConfig(): Promise<void> {
        const entry = this.readConfig().mcpServers['wmb-table'];
        const env: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined && key !== 'DISPLAY' && key !== 'WAYLAND_DISPLAY')
                env[key] = value;
        }
        const transport = new StdioClientTransport({
            command: entry.command,
            args: entry.args,
            env: { ...env, HOME: this.app.homeDir, XDG_CONFIG_HOME: this.app.configDir },
            stderr: 'pipe',
        });
        let stderr = '';
        transport.stderr?.on('data', (data) => (stderr += data));
        const client = new Client({ name: 'claude-desktop-e2e', version: '1.0.0' });
        try {
            await client.connect(transport);
            const tools = (await client.listTools()).tools.map((tool) => tool.name);
            this.ctx.check(
                'an MCP client started from the written Claude Desktop config lists the tools',
                tools.includes('searchSermons'),
                { tools, stderr: stderr.slice(-800) },
            );
        } catch (error) {
            this.ctx.check('the written Claude Desktop config starts the server', false, {
                error: String(error),
                stderr: stderr.slice(-800),
            });
        } finally {
            await client.close();
        }
    }
}
