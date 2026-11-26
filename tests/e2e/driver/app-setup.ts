import { copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppProcess } from './app-process';
import type { CdpSession } from './cdp';

export const MOCK_PROVIDER_ID = 'mock-llm';

export interface AppSetupOptions {
    repoRoot: string;
    cacheDir: string;
    mockBaseUrl: string;
    mockModelId: string;
    languageCode?: string;
}

interface AvailableLanguage {
    code: string;
    filesize: number;
}

async function pickSmallestLanguage(cdp: CdpSession): Promise<string> {
    const available = await cdp.evaluate<AvailableLanguage[]>(
        'window.api.languages.getAvailable()',
    );
    const [smallest] = [...available].sort((a, b) => a.filesize - b.filesize);
    return smallest.code;
}

function languageArchiveUrl(repoRoot: string, code: string): string {
    const db = new DatabaseSync(join(repoRoot, 'resources/database/data.sqlite'), {
        readOnly: true,
    });
    try {
        const row = db.prepare('SELECT url FROM language WHERE code = ?').get(code) as
            { url: string } | undefined;
        if (!row) throw new Error(`Language "${code}" is not in the reference database`);
        return row.url;
    } finally {
        db.close();
    }
}

async function ensureCachedArchive(options: AppSetupOptions, code: string): Promise<string> {
    const cached = join(options.cacheDir, `index-${code}.zip`);
    if (existsSync(cached)) return cached;
    mkdirSync(options.cacheDir, { recursive: true });
    const response = await fetch(languageArchiveUrl(options.repoRoot, code));
    if (!response.ok) {
        throw new Error(`Language pack download failed: HTTP ${response.status}`);
    }
    const partial = `${cached}.part`;
    writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    renameSync(partial, cached);
    return cached;
}

/**
 * The app reuses a finished download it finds at its temporary archive path (when the size
 * matches the remote file), so seeding that path skips the download on every run.
 */
async function installLanguagePack(
    cdp: CdpSession,
    app: AppProcess,
    options: AppSetupOptions,
): Promise<string> {
    const code = options.languageCode ?? (await pickSmallestLanguage(cdp));
    const archive = await ensureCachedArchive(options, code);
    const indexesDir = join(app.appDataDir, 'indexes');
    mkdirSync(indexesDir, { recursive: true });
    copyFileSync(archive, join(indexesDir, `.tmp-${code}.primary.zip.download`));
    await cdp.evaluate(`window.api.languages.install(${JSON.stringify(code)})`, 300_000);
    return code;
}

/** Lists the models like the settings page does, which is also how the app learns their limits. */
async function configureMockProvider(cdp: CdpSession, options: AppSetupOptions): Promise<void> {
    const provider = {
        id: MOCK_PROVIDER_ID,
        name: 'Mock LLM',
        baseUrl: options.mockBaseUrl,
        apiKey: 'mock-key',
        defaultModel: options.mockModelId,
        model: options.mockModelId,
    };
    await cdp.evaluate(
        `window.api.ai.updateSettings(${JSON.stringify({
            enabled: true,
            activeProvider: MOCK_PROVIDER_ID,
            customProviders: [provider],
        })})`,
    );
    const models = await cdp.evaluate<{ id: string }[]>(
        `window.api.ai.fetchProviderModels({ providerId: ${JSON.stringify(MOCK_PROVIDER_ID)} })`,
    );
    if (!models.some((model) => model.id === options.mockModelId)) {
        throw new Error(`The app did not list the mock model: ${JSON.stringify(models)}`);
    }
}

/** Prepares a fresh profile through the app's own preload API, then reloads the window. */
export async function setUpApp(
    cdp: CdpSession,
    app: AppProcess,
    options: AppSetupOptions,
): Promise<{ languageCode: string }> {
    await cdp.waitFor('typeof window.api?.app?.isInitialized === "function"', 'preload API');
    const languageCode = await installLanguagePack(cdp, app, options);
    await cdp.evaluate(`(async () => {
        await window.api.app.setUiLanguage('fr');
        await window.api.app.setContentLanguage(${JSON.stringify(languageCode)});
        await window.api.app.setThemeMode('system');
        await window.api.app.initialize();
    })()`);
    await configureMockProvider(cdp, options);
    await cdp.reload();
    return { languageCode };
}
