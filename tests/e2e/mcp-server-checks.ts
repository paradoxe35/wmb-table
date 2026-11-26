import { cpSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { DEFAULT_MCP_PORT, MCP_PORT_ATTEMPTS, buildMcpUrl } from '@shared/mcp.types';
import { AppProcess } from './driver/app-process';
import type { CdpSession } from './driver/cdp';
import type { SettingsPage } from './driver/settings-page';

export interface McpCheckContext {
    repoRoot: string;
    cdp: CdpSession;
    settings: SettingsPage;
    check(label: string, passed: boolean, details?: unknown): void;
    shot(name: string): Promise<string[]>;
    setUiLanguage(language: string): Promise<void>;
    reload(): Promise<void>;
}

const SECTION = '[data-testid="mcp-server-settings"]';
const ENABLED = '#mcp-server-enabled';
const ALLOW_WRITES = '#mcp-server-allow-writes';
const URL_CODE = `[data-testid="mcp-server-url"] .mcp-server__code pre`;
const CONFIGURATION = '[data-testid="mcp-configuration"]';
const HEADLESS = '[data-testid="mcp-headless"]';
const OTHER_APP_LABELS: Record<string, string> = {
    fr: 'Autre application',
    en: 'Other app',
    es: 'Otra aplicación',
    pt: 'Outro aplicativo',
    sw: 'Programu nyingine',
};
const ADVANCED_LABELS: Record<string, string> = {
    fr: 'Avancé',
    en: 'Advanced',
    es: 'Avanzado',
    pt: 'Avançado',
    sw: 'Ya kina',
};
const CLIENTS = [
    ['claude-code', 'Claude Code'],
    ['codex', 'Codex'],
    ['claude-desktop', 'Claude Desktop'],
] as const;
const ERROR = '[data-testid="mcp-server-error"]';
const WRITE_TOOLS = ['createNote', 'editNote', 'createSubject', 'removeSubjectReference'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface HeldPort {
    port: number;
    release(): Promise<void>;
}

/** Holds a loopback port; resolves to null when something else already holds it. */
export function holdPort(port: number): Promise<HeldPort | null> {
    return new Promise((resolve) => {
        const server: Server = createServer();
        server.once('error', () => resolve(null));
        server.listen(port, '127.0.0.1', () =>
            resolve({ port, release: () => new Promise((done) => server.close(() => done())) }),
        );
    });
}

async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: 'wmb-table-e2e', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    try {
        return await run(client);
    } finally {
        await client.close();
    }
}

async function toolNames(url: string): Promise<string[]> {
    return withClient(url, async (client) => (await client.listTools()).tools.map((t) => t.name));
}

async function refused(url: string): Promise<boolean> {
    try {
        await fetch(url, { method: 'POST' });
        return false;
    } catch (error) {
        return JSON.stringify((error as Error & { cause?: unknown }).cause ?? error).includes(
            'ECONNREFUSED',
        );
    }
}

/** Drives the MCP section of Settings → Assistant and talks to the server it starts. */
export class McpServerChecks {
    private readonly ctx: McpCheckContext;

    constructor(ctx: McpCheckContext) {
        this.ctx = ctx;
    }

    private visible(selector: string): Promise<boolean> {
        return this.ctx.cdp.evaluate(
            `[...document.querySelectorAll(${JSON.stringify(selector)})].some((el) => el.getBoundingClientRect().width > 0)`,
        );
    }

    private async showSection(): Promise<void> {
        await this.ctx.settings.openTab('ai');
        await this.ctx.cdp.waitFor(`Boolean(document.querySelector('${SECTION}'))`, 'MCP section');
        await this.ctx.cdp.evaluate(
            `document.querySelector('${SECTION}').scrollIntoView({ block: 'center' })`,
        );
    }

    private async shownUrl(): Promise<string> {
        return this.ctx.cdp.waitFor<string>(
            `document.querySelector('${URL_CODE}')?.innerText.trim() || null`,
            'MCP URL',
            15_000,
        );
    }

    /** Centred first: at the top edge, the sticky settings tabs would take the click. */
    private async toggle(selector: string, checked: boolean): Promise<void> {
        await this.ctx.cdp.evaluate(
            `document.querySelector('${selector}')?.scrollIntoView({ block: 'center' })`,
        );
        await this.ctx.settings.click(selector);
        await this.ctx.cdp.waitFor(
            `(() => { const box = document.querySelector('${selector}'); return box && box.checked === ${checked} && !box.disabled; })()`,
            `${selector} ${checked ? 'checked' : 'unchecked'}`,
            15_000,
        );
    }

    /** Moves the pointer onto the empty header so no tooltip shows in the screenshot. */
    private async sectionShot(name: string, focus = SECTION): Promise<void> {
        await this.ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 30 });
        await this.ctx.cdp.evaluate(
            `document.querySelector('${focus}').scrollIntoView({ block: 'center' })`,
        );
        await this.ctx.shot(name);
    }

    /** The first launch: off by default, on with the usual port, writes, off again. */
    async firstLaunch(defaultPortFree: boolean): Promise<string> {
        console.log('MCP: first launch');
        const { check } = this.ctx;
        await this.showSection();
        check('the MCP checkbox is off by default', !(await this.isChecked(ENABLED)));
        check(
            'while off, only the checkbox and its explanation show',
            !(await this.visible(ALLOW_WRITES)) && !(await this.visible(URL_CODE)),
        );
        if (defaultPortFree) {
            check(
                'the default port does not answer while the server is off',
                await refused(buildMcpUrl(DEFAULT_MCP_PORT)),
            );
        } else {
            console.log(
                `  skip the default-port checks: another process holds ${DEFAULT_MCP_PORT} on this machine`,
            );
        }
        await this.sectionShot('mcp-off');

        await this.toggle(ENABLED, true);
        const url = await this.shownUrl();
        const expected = buildMcpUrl(DEFAULT_MCP_PORT);
        if (defaultPortFree) {
            check('enabling shows the URL on the usual port', url === expected, url);
        }
        check('the write option shows once enabled', await this.visible(ALLOW_WRITES));
        check('changes are off by default', !(await this.isChecked(ALLOW_WRITES)));
        await this.sectionShot('mcp-on');
        await this.ctx.settings.click('button[aria-label="Copier Adresse du serveur"]');
        const copied = await this.ctx.cdp
            .waitFor(
                `Boolean(document.querySelector('button[aria-label="Copier Adresse du serveur"] .anticon-check'))`,
                'copied mark',
                5_000,
            )
            .then(() => true)
            .catch(() => false);
        check('the copy button copies the URL and says so', copied);
        await this.configurationShots(url);

        const readOnly = await toolNames(url);
        check('an MCP client lists the read tools', readOnly.includes('searchSermons'), readOnly);
        check(
            'no write tool is listed while changes are off',
            !readOnly.some((name) => WRITE_TOOLS.includes(name)),
            readOnly,
        );
        await this.searchSermons(url);
        await this.writeRefused(url);

        await this.toggle(ALLOW_WRITES, true);
        const withWrites = await toolNames(await this.shownUrl());
        check(
            'the write tools are listed once changes are allowed',
            WRITE_TOOLS.every((name) => withWrites.includes(name)),
            withWrites,
        );
        await this.createNote(url);
        await this.sectionShot('mcp-writes');

        await this.toggle(ENABLED, false);
        check(
            'when disabled again, the details are hidden',
            !(await this.visible(ALLOW_WRITES)) && !(await this.visible(URL_CODE)),
        );
        check('a disabled server refuses connections', await refused(url));
        const stored = await this.ctx.cdp.evaluate<{ settings: { allowWrites: boolean } }>(
            'window.api.mcp.getStatus()',
        );
        check(
            'the hidden write option keeps its value',
            stored.settings.allowWrites === true,
            stored,
        );
        await this.toggle(ENABLED, true);
        await this.toggle(ALLOW_WRITES, false);
        await this.shownUrl();
        await this.languageShots();
        return url;
    }

    /** After a relaunch with the usual port taken: autostart, fallback port, then no free port. */
    async afterRelaunch(heldDefault: boolean): Promise<void> {
        console.log('MCP: relaunch');
        const { check } = this.ctx;
        await this.ctx.setUiLanguage('fr');
        await this.ctx.reload();
        await this.showSection();
        const url = await this.shownUrl();
        check('the server starts by itself at launch', (await toolNames(url)).length > 0, url);
        const port = Number(new URL(url).port);
        check(
            'with the usual port taken, a following port is used and shown',
            port > DEFAULT_MCP_PORT &&
                port < DEFAULT_MCP_PORT + MCP_PORT_ATTEMPTS &&
                (await this.portHintShown()),
            { url, heldByThisRun: heldDefault },
        );
        await this.searchSermons(url);
        await this.sectionShot('mcp-port-fallback');
        await this.ctx.setUiLanguage('en');
        await this.ctx.reload();
        await this.showSection();
        await this.sectionShot('mcp-port-fallback-en');
        await this.ctx.setUiLanguage('fr');
        await this.ctx.reload();
        await this.showSection();

        await this.toggle(ENABLED, false);
        const held = (
            await Promise.all(
                Array.from({ length: MCP_PORT_ATTEMPTS }, (_, i) => holdPort(port + i)),
            )
        ).filter((h): h is HeldPort => h !== null);
        try {
            await this.toggle(ENABLED, true);
            await this.ctx.cdp.waitFor(`Boolean(document.querySelector('${ERROR}'))`, 'error');
            const message = (await this.ctx.settings.text(ERROR)).join(' ');
            check(
                'with no free port, a translated error names the ports',
                message.includes(`${port}`) && message.includes('déjà utilisés'),
                message,
            );
            check('no URL is shown while it failed', !(await this.visible(URL_CODE)));
            await this.sectionShot('mcp-error');
            await this.ctx.setUiLanguage('en');
            await this.ctx.reload();
            await this.showSection();
            await this.sectionShot('mcp-error-en');
            await this.ctx.setUiLanguage('fr');
            await this.ctx.reload();
            await this.showSection();
        } finally {
            await Promise.all(held.map((h) => h.release()));
        }
        await this.toggle(ENABLED, false);
        await this.toggle(ENABLED, true);
        const recovered = await this.shownUrl();
        check(
            'after the ports are freed, turning it on again works',
            (await toolNames(recovered)).includes('searchSermons'),
            recovered,
        );
        await this.toggle(ENABLED, false);
    }

    private async isChecked(selector: string): Promise<boolean> {
        return this.ctx.cdp.evaluate(`Boolean(document.querySelector('${selector}')?.checked)`);
    }

    private async portHintShown(): Promise<boolean> {
        const hints = await this.ctx.settings.text(`${SECTION} .ant-typography-secondary`);
        return hints.some((hint) => hint.includes(`${DEFAULT_MCP_PORT}`));
    }

    private async searchSermons(url: string): Promise<void> {
        const result = await withClient(url, (client) =>
            client.callTool({ name: 'searchSermons', arguments: { query: '1963' } }),
        );
        const [content] = (result.content ?? []) as { text?: string }[];
        const parsed = JSON.parse(content?.text ?? '{}') as { results?: unknown[] };
        this.ctx.check(
            'a sermon search through MCP returns results from the installed pack',
            !result.isError && (parsed.results?.length ?? 0) > 0,
            content?.text?.slice(0, 300),
        );
    }

    private async writeRefused(url: string): Promise<void> {
        const outcome = await withClient(url, (client) =>
            client
                .callTool({ name: 'createNote', arguments: { name: 'MCP refused', content: 'x' } })
                .then((result) => Boolean(result.isError))
                .catch(() => true),
        );
        const notes = await this.ctx.cdp.evaluate<{ name: string }[]>('window.api.notes.getAll()');
        this.ctx.check(
            'a write tool call is refused in read-only mode',
            outcome && !notes.some((note) => note.name === 'MCP refused'),
        );
    }

    private async createNote(url: string): Promise<void> {
        const name = "Note MCP : l'amour du Saint-Esprit";
        const result = await withClient(url, (client) =>
            client.callTool({ name: 'createNote', arguments: { name, content: 'Romains 5:5' } }),
        );
        const notes = await this.ctx.cdp.evaluate<{ name: string }[]>('window.api.notes.getAll()');
        this.ctx.check(
            'with changes allowed, an MCP client creates a note',
            !result.isError && notes.some((note) => note.name === name),
            result,
        );
    }

    private async openClient(label: string, client: string): Promise<void> {
        await this.ctx.settings.clickText(
            `${CONFIGURATION} .mcp-configuration__clients > .ant-tabs-nav .ant-tabs-tab`,
            label,
        );
        await this.ctx.cdp.waitFor(
            `Boolean(document.querySelector('[data-testid="mcp-client-${client}"]')?.getBoundingClientRect().width)`,
            `${client} tab`,
        );
    }

    private snippet(client: string, choice: 'recommended' | 'alternative'): Promise<string> {
        return this.ctx.cdp.evaluate<string>(
            `document.querySelector('[data-testid="mcp-snippet-${client}-${choice}"] pre')?.innerText ?? ''`,
        );
    }

    private async openAdvanced(language: string): Promise<void> {
        await this.ctx.settings.clickText(
            `${CONFIGURATION} .ant-collapse-header`,
            ADVANCED_LABELS[language],
        );
        await this.ctx.cdp.waitFor(
            `Boolean(document.querySelector('${HEADLESS}')?.getBoundingClientRect().width)`,
            'advanced section',
        );
        // The panel grows with an animation; scrolling to it before it ends stops short.
        await sleep(500);
    }

    /** The snippets must show this very copy of the app, so users never guess the path. */
    private async snippetsShowThisCopy(url: string): Promise<void> {
        const { launch } = await this.ctx.cdp.evaluate<{
            launch: { command: string; args: string[]; dev: boolean };
        }>('window.api.mcp.getStatus()');
        const electron = realpathSync(
            join(this.ctx.repoRoot, 'node_modules/electron/dist/electron'),
        );
        this.ctx.check(
            'the snippets name the real executable and app folder of this copy',
            realpathSync(launch.command) === electron &&
                launch.args.length === 1 &&
                realpathSync(launch.args[0]) === realpathSync(this.ctx.repoRoot) &&
                launch.dev,
            launch,
        );
        await this.openClient('Claude Code', 'claude-code');
        const recommended = await this.snippet('claude-code', 'recommended');
        const command = await this.snippet('claude-code', 'alternative');
        this.ctx.check(
            'Claude Code: HTTP is recommended, the command is the other way',
            recommended === `claude mcp add --transport http --scope user wmb-table ${url}` &&
                command.startsWith('claude mcp add --scope user wmb-table -- ') &&
                command.endsWith(`${launch.command} ${launch.args[0]} --no-sandbox mcp`),
            { recommended, command },
        );
        await this.openClient('Claude Desktop', 'claude-desktop');
        const desktop = JSON.parse(await this.snippet('claude-desktop', 'recommended')) as {
            mcpServers: Record<string, { command: string; args: string[] }>;
        };
        this.ctx.check(
            'Claude Desktop: the command over stdio is recommended',
            desktop.mcpServers['wmb-table']?.command === launch.command &&
                desktop.mcpServers['wmb-table']?.args.join(' ') ===
                    [...launch.args, '--no-sandbox', 'mcp'].join(' '),
            desktop,
        );
        this.ctx.check(
            'a development copy is labelled as such',
            (await this.ctx.settings.text(`${CONFIGURATION} .ant-typography-secondary`)).some(
                (hint) => hint.includes('Commande de développement'),
            ),
        );
    }

    private async configurationShots(url: string): Promise<void> {
        await this.snippetsShowThisCopy(url);
        for (const [key, label] of CLIENTS) {
            await this.openClient(label, key);
            await this.sectionShot(`mcp-config-${key}`);
        }
        await this.openClient(OTHER_APP_LABELS.fr, 'other');
        await this.sectionShot('mcp-config-other');
        await this.openAdvanced('fr');
        await this.sectionShot('mcp-config-advanced', HEADLESS);
        await this.openClient('Claude Code', 'claude-code');
    }

    private async languageShots(): Promise<void> {
        for (const language of ['en', 'es', 'pt', 'sw']) {
            await this.ctx.setUiLanguage(language);
            await this.ctx.reload();
            await this.showSection();
            await this.shownUrl();
            await this.sectionShot(`mcp-on-${language}`);
            if (language === 'en') {
                await this.toggle(ALLOW_WRITES, true);
                await this.sectionShot('mcp-writes-en');
                await this.toggle(ALLOW_WRITES, false);
            }
            await this.openClient('Claude Desktop', 'claude-desktop');
            await this.sectionShot(`mcp-config-claude-desktop-${language}`);
            await this.openClient(OTHER_APP_LABELS[language], 'other');
            await this.openAdvanced(language);
            await this.sectionShot(`mcp-config-other-advanced-${language}`, HEADLESS);
            await this.toggle(ENABLED, false);
            await this.sectionShot(`mcp-off-${language}`);
            await this.toggle(ENABLED, true);
        }
        await this.ctx.setUiLanguage('fr');
        await this.ctx.reload();
    }
}

/**
 * Quits the app the way a user does (its window closes), then starts it again on a copy of
 * the same profile, so settings and the language pack carry over.
 */
export async function relaunchWithSameProfile(
    previous: AppProcess,
    cdp: CdpSession,
    shownUrl: string,
    options: ConstructorParameters<typeof AppProcess>[0],
    beforeStart: () => Promise<void>,
): Promise<{ app: AppProcess; cdp: CdpSession; quitClosedServer: boolean }> {
    await cdp.evaluate('window.close()').catch(() => undefined);
    cdp.close();
    let quitClosedServer = false;
    for (let i = 0; i < 100 && !quitClosedServer; i++) {
        await sleep(100);
        quitClosedServer = await refused(shownUrl);
    }
    await sleep(2000);
    const next = new AppProcess(options);
    cpSync(previous.homeDir, next.homeDir, { recursive: true });
    cpSync(previous.configDir, next.configDir, { recursive: true });
    await previous.stop();
    await beforeStart();
    return { app: next, cdp: await next.start(), quitClosedServer };
}
