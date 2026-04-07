import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { _setRefDbForTesting } from '@main/database/reference-db';
import { createTestDb } from '../database/test-helpers';

const DATA_SQLITE_PATH = resolve(__dirname, '../../../../resources/database/data.sqlite');
const { mockInstalledLanguages, githubHeadMock } = vi.hoisted(() => ({
    mockInstalledLanguages: vi.fn<() => string[]>(() => ['en', 'fr']),
    githubHeadMock: vi.fn(),
}));

let db: Database.Database;

beforeAll(() => {
    db = new Database(DATA_SQLITE_PATH, { readonly: true });
    _setRefDbForTesting(db);
});

afterAll(() => {
    db.close();
});

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/test-wmb-table',
        isPackaged: false,
    },
}));

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: mockInstalledLanguages,
    openIndex: vi.fn(),
    closeAllIndexes: vi.fn(),
    initializeTantivy: vi.fn(),
}));

vi.mock('@main/lib/github', () => ({
    githubDownload: vi.fn(),
    githubHead: githubHeadMock,
    getGitHubReleaseAssetUrl: vi.fn(
        (fileName: string) => `https://github.test/releases/${fileName}`,
    ),
}));

describe('language-pack.service', () => {
    beforeEach(() => {
        createTestDb();
        vi.clearAllMocks();
        mockInstalledLanguages.mockReturnValue(['en', 'fr']);
        githubHeadMock.mockReset();
        globalThis.fetch = vi.fn() as typeof fetch;
    });

    it('getInstalledLanguages returns expected data', async () => {
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');
        const installed = await getInstalledLanguages();

        expect(installed).toHaveLength(2);
        expect(installed.map((l) => l.code).sort()).toEqual(['en', 'fr']);
        expect(installed.find((l) => l.code === 'en')!.sermonsCount).toBeGreaterThan(0);
        expect(installed.find((l) => l.code === 'fr')!.sermonsCount).toBeGreaterThan(0);
        expect(installed.every((language) => language.updateAvailable === false)).toBe(true);
    });

    it('getInstalledLanguages uses deduplicated sermon count for French', async () => {
        const refRepo = await import('@main/database/repositories/reference.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');
        const installed = await getInstalledLanguages();
        const fr = installed.find((l) => l.code === 'fr')!;

        const uniqueCount = refRepo.getUniqueSermonCountForLanguage('fr');
        const totalCount = refRepo.getTranslationCountForLanguage('fr');

        expect(fr.sermonsCount).toBe(uniqueCount);
        if (uniqueCount < totalCount) {
            expect(fr.sermonsCount).toBeLessThan(totalCount);
        }
    });

    it('getDownloadableLanguages returns all languages from data.sqlite', async () => {
        const { getDownloadableLanguages } = await import('@main/services/language-pack.service');
        const downloadable = await getDownloadableLanguages();

        expect(downloadable.length).toBeGreaterThan(10);

        const en = downloadable.find((l) => l.code === 'en')!;
        expect(en).toBeDefined();
        expect(en.installed).toBe(true);

        const de = downloadable.find((l) => l.code === 'de')!;
        expect(de).toBeDefined();
        expect(de.installed).toBe(false);
        expect(de.filesize).toBeGreaterThan(0);
    });

    it('includes persisted updateAvailable state for installed languages', async () => {
        const languageSourcesRepo =
            await import('@main/database/repositories/language-sources.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');

        languageSourcesRepo.upsertInstalledLanguageSource({
            langCode: 'en',
            sourceType: 'primary',
            sourceUrl: 'https://example.test/index-en.zip',
            fileName: 'index-en.zip',
            etag: 'etag-1',
            lastModified: null,
            contentLength: 123,
            versionId: null,
            updateAvailable: true,
        });

        const installed = await getInstalledLanguages();
        expect(installed.find((language) => language.code === 'en')?.updateAvailable).toBe(true);
    });

    it('checks primary sources with HEAD and marks updates when the ETag changes', async () => {
        const refRepo = await import('@main/database/repositories/reference.repository');
        const languageSourcesRepo =
            await import('@main/database/repositories/language-sources.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');

        mockInstalledLanguages.mockReturnValue(['en']);
        languageSourcesRepo.upsertInstalledLanguageSource({
            langCode: 'en',
            sourceType: 'primary',
            sourceUrl: 'https://example.test/index-en.zip',
            fileName: 'index-en.zip',
            etag: 'etag-old',
            lastModified: null,
            contentLength: 123,
            versionId: null,
            updateAvailable: false,
        });

        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(null, {
                status: 200,
                headers: { ETag: 'etag-new', 'Content-Length': '123' },
            }),
        ) as typeof fetch;

        const installed = await getInstalledLanguages({ checkForUpdates: true, force: true });
        expect(globalThis.fetch).toHaveBeenCalledWith(refRepo.getLanguageByCode('en')?.url, {
            method: 'HEAD',
        });
        expect(installed.find((language) => language.code === 'en')?.updateAvailable).toBe(true);
        expect(languageSourcesRepo.getInstalledLanguageSource('en')?.updateAvailable).toBe(true);
    });

    it('falls back to the stored primary source URL when the current reference URL fails', async () => {
        const refRepo = await import('@main/database/repositories/reference.repository');
        const languageSourcesRepo =
            await import('@main/database/repositories/language-sources.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');

        mockInstalledLanguages.mockReturnValue(['en']);
        languageSourcesRepo.upsertInstalledLanguageSource({
            langCode: 'en',
            sourceType: 'primary',
            sourceUrl: 'https://fallback.example.test/index-en.zip',
            fileName: 'index-en.zip',
            etag: 'etag-old',
            lastModified: null,
            contentLength: 123,
            versionId: null,
            updateAvailable: false,
        });

        globalThis.fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 200,
                    headers: { ETag: 'etag-new' },
                }),
            ) as typeof fetch;

        const installed = await getInstalledLanguages({ checkForUpdates: true, force: true });

        expect(globalThis.fetch).toHaveBeenNthCalledWith(1, refRepo.getLanguageByCode('en')?.url, {
            method: 'HEAD',
        });
        expect(globalThis.fetch).toHaveBeenNthCalledWith(
            2,
            'https://fallback.example.test/index-en.zip',
            { method: 'HEAD' },
        );
        expect(installed.find((language) => language.code === 'en')?.updateAvailable).toBe(true);
    });

    it('uses github HEAD checks for languages installed from GitHub fallback', async () => {
        const languageSourcesRepo =
            await import('@main/database/repositories/language-sources.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');

        mockInstalledLanguages.mockReturnValue(['en']);
        languageSourcesRepo.upsertInstalledLanguageSource({
            langCode: 'en',
            sourceType: 'github',
            sourceUrl: 'https://github.test/releases/index-en.zip',
            fileName: 'index-en.zip',
            etag: 'etag-old',
            lastModified: null,
            contentLength: 123,
            versionId: null,
            updateAvailable: false,
        });

        githubHeadMock.mockResolvedValue(
            new Response(null, {
                status: 200,
                headers: { ETag: 'etag-new' },
            }),
        );

        const installed = await getInstalledLanguages({ checkForUpdates: true, force: true });
        expect(githubHeadMock).toHaveBeenCalledWith('index-en.zip');
        expect(installed.find((language) => language.code === 'en')?.updateAvailable).toBe(true);
    });

    it('bootstraps tracking metadata for legacy installs without stored source data', async () => {
        const languageSourcesRepo =
            await import('@main/database/repositories/language-sources.repository');
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');

        mockInstalledLanguages.mockReturnValue(['en']);
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(null, {
                status: 200,
                headers: {
                    ETag: 'etag-current',
                    'Content-Length': '321',
                    'Last-Modified': 'Tue, 07 Apr 2026 12:00:00 GMT',
                },
            }),
        ) as typeof fetch;

        const installed = await getInstalledLanguages({ checkForUpdates: true, force: true });
        const stored = languageSourcesRepo.getInstalledLanguageSource('en');

        expect(installed.find((language) => language.code === 'en')?.updateAvailable).toBe(false);
        expect(stored).toMatchObject({
            langCode: 'en',
            sourceType: 'primary',
            fileName: 'index-en.zip',
            etag: 'etag-current',
            contentLength: 321,
        });
    });
});
