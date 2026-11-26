import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { AssistantOnboarding } from './assistant-onboarding';
import { AppProcess } from './driver/app-process';
import { MOCK_PROVIDER_ID, setUpApp } from './driver/app-setup';
import type { CdpSession } from './driver/cdp';
import { ChatPage } from './driver/chat-page';
import { SettingsPage } from './driver/settings-page';
import { MOCK_MODEL_ID } from './mock-llm/scenario';
import { startMockLlmServer } from './mock-llm/server';

const repoRoot = resolve(import.meta.dirname, '../..');
const field = (name: string) => `#ai-${MOCK_PROVIDER_ID}-${name}`;
const UNREACHABLE_URL = 'http://127.0.0.1:9/v1';
const DESKTOP_VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };

interface Check {
    label: string;
    passed: boolean;
    details?: unknown;
    knownBug?: string;
}

interface AiSettingsLike {
    activeProvider: string | null;
    languagePreference: string;
    providers: Record<string, { apiKey?: string; baseUrl?: string }>;
    customProviders: { id: string; name: string; apiKey?: string; baseUrl: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class SettingsRun {
    readonly checks: Check[] = [];
    private readonly cdp: CdpSession;
    private readonly settings: SettingsPage;
    private readonly screens: ChatPage;
    private readonly mockBaseUrl: string;

    constructor(cdp: CdpSession, screenDir: string, mockBaseUrl: string) {
        this.cdp = cdp;
        this.settings = new SettingsPage(cdp);
        this.screens = new ChatPage(cdp, screenDir);
        this.mockBaseUrl = mockBaseUrl;
    }

    /** A failing `knownBug` check is reported as BUG without failing the run. */
    check(label: string, passed: boolean, details?: unknown, knownBug?: string): void {
        this.checks.push({ label, passed, details: passed ? undefined : details, knownBug });
        const status = knownBug ? (passed ? 'FIX?' : 'BUG ') : passed ? 'ok  ' : 'FAIL';
        const note = knownBug ? ` [${knownBug}]` : '';
        console.log(`  ${status} ${label}${note}${passed ? '' : ` ${JSON.stringify(details)}`}`);
    }

    async onboarding(app: AppProcess): Promise<void> {
        await new AssistantOnboarding({
            cdp: this.cdp,
            settings: this.settings,
            chat: this.screens,
            appDataDir: app.appDataDir,
            mockBaseUrl: this.mockBaseUrl,
            check: (...args) => this.check(...args),
            shot: (name) => this.shot(name),
            reload: () => this.reload(),
            setUiLanguage: (language) => this.setUiLanguage(language),
        }).run();
    }

    /**
     * After a reload the app takes its first theme from the main process, so the emulated
     * colour scheme is toggled to send the page a change event it follows again.
     */
    async reload(): Promise<void> {
        await this.cdp.reload();
        await this.cdp.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: 'dark' }],
        });
        await this.screens.setTheme('light');
    }

    /** The renderer keeps its own copy of the preference and pushes it to main on load. */
    async setUiLanguage(language: string): Promise<void> {
        await this.cdp.evaluate(`(async () => {
            const stored = JSON.parse(localStorage.getItem('wmb-theme') ?? '{"state":{}}');
            stored.state.uiLanguagePreference = '${language}';
            localStorage.setItem('wmb-theme', JSON.stringify(stored));
            await window.api.app.setUiLanguage('${language}');
        })()`);
    }

    aiSettings(): Promise<AiSettingsLike> {
        return this.cdp.evaluate('window.api.ai.getSettings()');
    }

    async mockProvider() {
        return (await this.aiSettings()).customProviders.find((p) => p.id === MOCK_PROVIDER_ID);
    }

    shot(name: string): Promise<string[]> {
        return this.screens.screenshotBothThemes(name);
    }

    async countSaves<T>(action: () => Promise<T>): Promise<number> {
        await this.cdp.evaluate(`(() => {
            window.__aiSaves = 0;
            window.__countAiSave ??= () => window.__aiSaves++;
            window.removeEventListener('ai-settings-updated', window.__countAiSave);
            window.addEventListener('ai-settings-updated', window.__countAiSave);
        })()`);
        await action();
        return this.cdp.evaluate('window.__aiSaves');
    }

    async run(): Promise<void> {
        const s = this.settings;
        await s.openTab('ai');
        await this.cdp.waitFor(
            `Boolean(document.querySelector('${field('apiKey')}'))`,
            'mock card',
        );
        await this.shot('custom-provider');

        console.log('S1: debounced input keeps the latest value');
        await s.paste(field('apiKey'), '  typed-key-leave \n');
        await s.leaveSettings();
        await sleep(150);
        this.check(
            'a key typed right before leaving settings is saved at once (trimmed)',
            (await this.mockProvider())?.apiKey === 'typed-key-leave',
            await this.mockProvider(),
        );

        await s.openTab('ai');
        await s.paste(field('apiKey'), 'typed-key-rerender');
        await s.selectOption('ai-language-preference', 'Changer uniquement sur demande');
        await sleep(1200);
        const afterRerender = await this.aiSettings();
        this.check(
            'a key typed while another setting re-renders the card is saved',
            afterRerender.customProviders[0]?.apiKey === 'typed-key-rerender',
            afterRerender.customProviders[0],
        );
        this.check(
            'the other setting is saved too',
            afterRerender.languagePreference === 'explicit-only',
            afterRerender.languagePreference,
        );

        await s.paste(field('baseUrl'), ` ${this.mockBaseUrl}/ `);
        await s.pressTab();
        await sleep(150);
        this.check(
            'leaving the field (blur) saves at once, normalized',
            (await this.mockProvider())?.baseUrl === this.mockBaseUrl,
            await this.mockProvider(),
        );

        const saves = await this.countSaves(async () => {
            await s.type(field('apiKey'), 'mock-key', 60);
            await sleep(1000);
        });
        this.check('rapid typing gives one save', saves === 1, saves);
        this.check(
            'rapid typing saves the last value',
            (await this.mockProvider())?.apiKey === 'mock-key',
            await this.mockProvider(),
        );

        console.log('S7: base URL checks');
        await s.paste(field('baseUrl'), 'localhost:1234');
        await sleep(900);
        this.check(
            'an URL without scheme shows an inline error',
            (await s.text(`${field('baseUrl')}-error`)).join('').includes('http://'),
            await s.text(`${field('baseUrl')}-error`),
        );
        this.check(
            'an URL without scheme is not saved',
            (await this.mockProvider())?.baseUrl === this.mockBaseUrl,
            await this.mockProvider(),
        );
        await this.shot('custom-invalid-url');
        await s.paste(field('baseUrl'), this.mockBaseUrl);
        await s.pressTab();

        console.log('S13: connection test');
        await s.clickText('button', 'Tester la connexion');
        await this.cdp.waitFor(
            `[...document.querySelectorAll('.ant-tag-success')].some((t) => t.innerText.includes('Connecté'))`,
            'connected tag',
            30_000,
        );
        this.check('the connection test passes against the mock', true);
        await this.shot('custom-provider-tested');

        console.log('S6/S7/S11: add a provider');
        await s.clickText('.ant-card button', 'Ajouter un fournisseur');
        await this.cdp.waitFor(
            `Boolean(document.querySelector('#ai-custom-provider-name'))`,
            'modal',
        );
        await s.paste('#ai-custom-provider-name', 'Mock LLM');
        await s.paste('#ai-custom-provider-base-url', 'ftp://127.0.0.1:9/v1');
        await s.paste('#ai-custom-provider-model', 'm1');
        await sleep(300);
        const modalErrors = await s.text('.ant-modal .ant-form-item-explain-error');
        this.check(
            'the modal shows a duplicate-name error',
            modalErrors.some((e) => e.includes('existe déjà')),
            modalErrors,
        );
        this.check(
            'the modal shows an URL scheme error',
            modalErrors.some((e) => e.includes('http://')),
            modalErrors,
        );
        this.check(
            'Add is disabled while the draft has errors',
            await this.cdp.evaluate(
                `document.querySelector('.ant-modal-footer .ant-btn-primary').disabled`,
            ),
        );
        await this.shot('add-provider-errors');
        await s.paste('#ai-custom-provider-name', 'مساعدي 🤖');
        await s.paste('#ai-custom-provider-base-url', ` ${UNREACHABLE_URL}/ `);
        await s.paste('#ai-custom-provider-api-key', ' sk-arabic \n');
        await sleep(200);
        this.check(
            'Add is enabled for an Arabic + emoji name',
            !(await this.cdp.evaluate(
                `document.querySelector('.ant-modal-footer .ant-btn-primary').disabled`,
            )),
        );
        await s.click('.ant-modal-footer .ant-btn-primary');
        await this.cdp.waitFor(
            `!document.querySelector('.ant-modal-wrap:not([style*="display: none"]) #ai-custom-provider-name')`,
            'modal closed',
        );
        await sleep(300);
        const added = await this.aiSettings();
        const arabic = added.customProviders.find((p) => p.name === 'مساعدي 🤖');
        this.check('the provider is added with a safe id', arabic?.id === 'custom', arabic);
        this.check(
            'the new provider is active',
            added.activeProvider === arabic?.id,
            added.activeProvider,
        );
        this.check(
            'its URL and key are trimmed',
            arabic?.baseUrl === UNREACHABLE_URL && arabic?.apiKey === 'sk-arabic',
            arabic,
        );

        await s.clickText('button', 'Tester la connexion');
        await this.cdp.waitFor(
            `Boolean(document.querySelector('.ant-card [role="alert"]'))`,
            'test failure',
            30_000,
        );
        const failure = await s.text('.ant-card [role="alert"]');
        this.check(
            'an unreachable server gives a short translated message',
            failure.join(' ').includes('Impossible de joindre le serveur'),
            failure,
        );
        await this.shot('test-failure');

        console.log('S17: deleting the active provider');
        await s.click('button[aria-label="Supprimer le fournisseur مساعدي 🤖"]');
        await s.click('.ant-popconfirm-buttons .ant-btn-primary');
        await sleep(400);
        const afterDelete = await this.aiSettings();
        this.check(
            'the active provider is cleared',
            afterDelete.activeProvider === null &&
                !afterDelete.customProviders.some((p) => p.id === 'custom'),
            afterDelete,
        );
        const warnings = await s.text('.ant-alert-warning');
        this.check(
            'a "choose a provider" warning is shown',
            warnings.some((w) => w.includes('Choisissez un fournisseur')),
            warnings,
        );
        await this.shot('no-provider-warning');

        console.log('S10: builtin providers');
        await s.selectOption('ai-active-provider', 'OpenAI');
        await this.cdp.waitFor(
            `Boolean(document.querySelector('#ai-openai-apiKey'))`,
            'openai card',
        );
        const openaiTags = await s.text('.ant-card-head .ant-tag');
        this.check('OpenAI is tagged Cloud', openaiTags.includes('Cloud'), openaiTags);
        const keyWarning = await s.text('.ant-alert-warning');
        this.check(
            'a missing-key warning is shown',
            keyWarning.some((w) => w.includes('clé API')),
            keyWarning,
        );
        await this.shot('builtin-cloud');

        await s.paste('#ai-openai-apiKey', 'sk-switch-provider');
        await s.selectOption('ai-active-provider', 'Ollama');
        await this.cdp.waitFor(
            `Boolean(document.querySelector('#ai-ollama-baseUrl'))`,
            'ollama card',
        );
        await sleep(150);
        const openai = (await this.aiSettings()).providers.openai;
        this.check(
            'a key typed right before switching provider is saved',
            openai.apiKey === 'sk-switch-provider',
            openai,
        );
        const ollamaTags = await s.text('.ant-card-head .ant-tag');
        this.check('Ollama is tagged Local', ollamaTags.includes('Local'), ollamaTags);
        await s.paste('#ai-ollama-baseUrl', 'http://localhost:11434');
        await s.pressTab();
        await sleep(200);
        const ollama = (await this.aiSettings()).providers.ollama;
        this.check(
            'the Ollama URL gets /v1 added',
            ollama.baseUrl === 'http://localhost:11434/v1',
            ollama,
        );
        await this.cdp.waitFor(
            `document.querySelector('#ai-ollama-baseUrl').value === 'http://localhost:11434/v1'`,
            'normalized URL shown',
        );
        await this.shot('builtin-ollama');

        this.check(
            'the AI tab has no on/off switch',
            !(await this.cdp.evaluate(`Boolean(document.querySelector('#ai-enabled'))`)),
        );

        console.log('labels');
        const unlabeled = await this.cdp.evaluate<
            string[]
        >(`[...document.querySelectorAll('.settings-page input')]
            .filter((input) => input.getBoundingClientRect().width > 0 && input.type !== 'hidden')
            .filter((input) => !(input.labels?.length) && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby'))
            .map((input) => input.id || input.outerHTML.slice(0, 80))`);
        this.check(
            'every visible AI settings input has a label',
            unlabeled.length === 0,
            unlabeled,
        );
    }

    async saveError(app: AppProcess): Promise<void> {
        console.log('S5: save error');
        await this.cdp.evaluate(
            `window.api.ai.updateSettings({ activeProvider: ${JSON.stringify(MOCK_PROVIDER_ID)} })`,
        );
        const db = new DatabaseSync(join(app.appDataDir, 'databases', 'wmb-table.sqlite'));
        try {
            const row = db
                .prepare("SELECT custom_providers FROM ai_settings WHERE id = 'ai_settings'")
                .get() as { custom_providers: string };
            const providers = JSON.parse(row.custom_providers) as { id: string; baseUrl: string }[];
            const broken = providers.map((p) =>
                p.id === MOCK_PROVIDER_ID ? { ...p, baseUrl: 'ftp://legacy-host/v1' } : p,
            );
            db.prepare("UPDATE ai_settings SET custom_providers = ? WHERE id = 'ai_settings'").run(
                JSON.stringify(broken),
            );
        } finally {
            db.close();
        }
        await this.reload();
        await this.settings.openTab('ai');
        await this.settings.paste(field('apiKey'), 'key-that-cannot-save');
        await this.settings.pressTab();
        await this.cdp.waitFor(
            `Boolean(document.querySelector('.ant-message-error'))`,
            'error message',
            10_000,
        );
        const message = await this.settings.text('.ant-message-error');
        this.check(
            'a failed save tells the user',
            message.join('').includes("n'ont pas pu être enregistrés"),
            message,
        );
        await this.shot('save-error');
        await this.cdp.evaluate(`(async () => {
            const s = await window.api.ai.getSettings();
            await window.api.ai.updateSettings({ customProviders: s.customProviders.map((p) => ({ ...p, baseUrl: ${JSON.stringify(this.mockBaseUrl)}, apiKey: 'mock-key' })) });
        })()`);
        await this.reload();
    }

    async ttsKeys(): Promise<void> {
        console.log('TTS keys still saved');
        for (const [provider, placeholder] of [
            ['openai', 'sk-...'],
            ['elevenlabs', 'xi_...'],
        ] as const) {
            await this.cdp.evaluate(
                `window.api.tts.updateSettings({ activeProvider: '${provider}' })`,
            );
            await this.reload();
            await this.settings.openTab('tts');
            const selector = `.settings-page input[placeholder="${placeholder}"]`;
            await this.settings.paste(selector, `tts-${provider}-key`);
            await this.settings.leaveSettings();
            await sleep(300);
            const saved = await this.cdp.evaluate<string | undefined>(
                `window.api.tts.getSettings().then((s) => s.providers['${provider}'].apiKey)`,
            );
            this.check(
                `a ${provider} TTS key typed right before leaving is saved`,
                saved === `tts-${provider}-key`,
                saved,
            );
        }
        await this.cdp.evaluate(`window.api.tts.updateSettings({ activeProvider: 'sherpa' })`);
    }

    async languages(): Promise<void> {
        for (const language of ['en', 'es', 'pt', 'sw']) {
            await this.setUiLanguage(language);
            await this.reload();
            await this.settings.openTab('ai');
            await this.cdp.waitFor(
                `Boolean(document.querySelector('${field('apiKey')}'))`,
                'mock card',
            );
            await this.shot(`custom-provider-${language}`);
            if (language === 'en') {
                await this.settings.click(
                    '.ant-card .ant-select + button, .ant-card button:has(.anticon-plus)',
                );
                await this.cdp.waitFor(
                    `Boolean(document.querySelector('#ai-custom-provider-name'))`,
                    'modal',
                );
                await this.settings.paste('#ai-custom-provider-name', 'Mock LLM');
                await this.settings.paste('#ai-custom-provider-base-url', 'localhost:11434');
                await sleep(300);
                await this.shot('add-provider-errors-en');
                const errors = await this.settings.text('.ant-modal .ant-form-item-explain-error');
                this.check(
                    'modal errors are in English',
                    errors.some((e) => e.includes('must start with')),
                    errors,
                );
                await this.settings.clickText('.ant-modal-footer button', 'Cancel');
            }
        }
        await this.setUiLanguage('fr');
        await this.reload();
    }

    async smallWindow(): Promise<void> {
        await this.cdp.send('Emulation.setDeviceMetricsOverride', {
            width: 700,
            height: 800,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await this.settings.openTab('ai');
        await this.shot('small-window');
        await this.cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP_VIEWPORT);
    }
}

async function main(): Promise<boolean> {
    const { values } = parseArgs({
        args: process.argv.slice(2).filter((arg) => arg !== '--'),
        options: { out: { type: 'string' }, 'cache-dir': { type: 'string' } },
    });
    const outDir = resolve(values.out ?? join(repoRoot, 'tmp/e2e-output/settings'));
    mkdirSync(outDir, { recursive: true });
    const server = await startMockLlmServer({ logFile: join(outDir, 'llm-requests.jsonl') });
    const app = new AppProcess({ repoRoot, profileParent: join(repoRoot, 'tmp/e2e-profiles') });
    let cdp: CdpSession | null = null;
    let run: SettingsRun | null = null;
    try {
        cdp = await app.start();
        await setUpApp(cdp, app, {
            repoRoot,
            cacheDir: resolve(values['cache-dir'] ?? join(repoRoot, 'tmp/e2e-cache')),
            mockBaseUrl: server.baseUrl,
            mockModelId: MOCK_MODEL_ID,
        });
        await cdp.send('Emulation.setDeviceMetricsOverride', DESKTOP_VIEWPORT);
        run = new SettingsRun(cdp, join(outDir, 'screens'), server.baseUrl);
        await run.onboarding(app);
        await run.run();
        await run.saveError(app);
        await run.ttsKeys();
        await run.smallWindow();
        await run.languages();
    } catch (error) {
        if (cdp) writeFileSync(join(outDir, 'failure.png'), await cdp.screenshot());
        throw error;
    } finally {
        writeFileSync(join(outDir, 'main.log'), app.mainLog());
        writeFileSync(
            join(outDir, 'renderer-console-errors.json'),
            JSON.stringify(cdp?.consoleErrors ?? [], null, 2),
        );
        cdp?.close();
        await app.stop();
        await server.close();
    }
    const checks = run?.checks ?? [];
    const failed = checks.filter((c) => !c.passed && !c.knownBug);
    const knownBugs = checks.filter((c) => !c.passed && c.knownBug).length;
    console.log(
        `\n${checks.length - failed.length - knownBugs}/${checks.length} checks passed, ${knownBugs} known-bug checks still failing. Output: ${outDir}`,
    );
    return failed.length === 0;
}

main()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
