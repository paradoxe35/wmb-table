import { cpSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { DEFAULT_MCP_PORT, MCP_PORT_ATTEMPTS, buildMcpUrl } from '@shared/mcp.types';
import { AppProcess } from './driver/app-process';
import type { CdpSession } from './driver/cdp';
import type { SettingsPage } from './driver/settings-page';

export interface McpCheckContext {
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
const URL_CODE = `${SECTION} .mcp-server__code pre`;
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

    private async toggle(selector: string, checked: boolean): Promise<void> {
        await this.ctx.settings.click(selector);
        await this.ctx.cdp.waitFor(
            `(() => { const box = document.querySelector('${selector}'); return box && box.checked === ${checked} && !box.disabled; })()`,
            `${selector} ${checked ? 'checked' : 'unchecked'}`,
            15_000,
        );
    }

    /** Moves the pointer onto the empty header so no tooltip shows in the screenshot. */
    private async sectionShot(name: string): Promise<void> {
        await this.ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 30 });
        await this.ctx.cdp.evaluate(
            `document.querySelector('${SECTION}').scrollIntoView({ block: 'center' })`,
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
        check(
            'the default port does not answer while the server is off',
            await refused(buildMcpUrl(DEFAULT_MCP_PORT)),
        );
        await this.sectionShot('mcp-off');

        await this.toggle(ENABLED, true);
        const url = await this.shownUrl();
        const expected = buildMcpUrl(DEFAULT_MCP_PORT);
        check('enabling shows the URL on the usual port', !defaultPortFree || url === expected, {
            url,
            defaultPortFree,
        });
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
        await this.snippetShots();

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
            'with the usual port taken, the next port is used and shown',
            port === DEFAULT_MCP_PORT + 1 && (await this.portHintShown()),
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

    private async snippetShots(): Promise<void> {
        for (const [key, label] of [
            ['codex', 'Codex'],
            ['claude-desktop', 'Claude Desktop'],
        ] as const) {
            await this.ctx.settings.clickText(`${SECTION} .ant-tabs-tab`, label);
            await this.ctx.cdp.waitFor(
                `Boolean(document.querySelector('[data-testid="mcp-snippet-${key}"]')?.getBoundingClientRect().width)`,
                `${key} snippet`,
            );
            await this.sectionShot(`mcp-on-${key}`);
        }
        await this.ctx.settings.clickText(`${SECTION} .ant-tabs-tab`, 'Claude Code');
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
