import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { _setRefDbForTesting } from '@main/database/reference-db';

const DATA_SQLITE_PATH = resolve(__dirname, '../../../../resources/database/data.sqlite');

let db: Database.Database;

beforeAll(() => {
    db = new Database(DATA_SQLITE_PATH, { readonly: true });
    _setRefDbForTesting(db);
});

afterAll(() => {
    db.close();
});

// Mock electron app
vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/test-wmb-table',
        isPackaged: false,
    },
}));

// Mock electron-log
vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock tantivy service
vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: vi.fn(() => ['en', 'fr']),
    openIndex: vi.fn(),
    closeAllIndexes: vi.fn(),
    initializeTantivy: vi.fn(),
}));

describe('language-pack.service', () => {
    it('getInstalledLanguages returns expected data', async () => {
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');
        const installed = await getInstalledLanguages();

        expect(installed).toHaveLength(2);
        expect(installed.map((l) => l.code).sort()).toEqual(['en', 'fr']);
        // English should have all sermons
        expect(installed.find((l) => l.code === 'en')!.sermonsCount).toBeGreaterThan(0);
        // French should have translations
        expect(installed.find((l) => l.code === 'fr')!.sermonsCount).toBeGreaterThan(0);
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
});
