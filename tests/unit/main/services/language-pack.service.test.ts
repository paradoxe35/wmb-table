import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb } from '../database/test-helpers';

// Mock electron app
vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/test-wmb-table',
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

// Mock sermon metadata service
vi.mock('@main/services/sermon-metadata.service', () => ({
    buildMetadataFromIndex: vi.fn(),
}));

// Mock sermon metadata repo
vi.mock('@main/database/repositories/sermon-metadata.repository', () => ({
    getSermonList: vi.fn((code: string) => {
        if (code === 'en') return Array(100).fill({});
        if (code === 'fr') return Array(50).fill({});
        return [];
    }),
    deleteByLanguage: vi.fn(),
}));

import type { Manifest } from '@main/services/language-pack.service';

const MOCK_MANIFEST: Manifest = {
    version: 1,
    languages: [
        {
            code: 'en',
            language: 'English',
            sermons_available: 1200,
            sermons_with_audio: 800,
            filename: 'en.zip',
            filesize: 50000000,
            checksum: 'abc123',
        },
        {
            code: 'fr',
            language: 'French',
            sermons_available: 1100,
            sermons_with_audio: 600,
            filename: 'fr.zip',
            filesize: 45000000,
            checksum: 'def456',
        },
        {
            code: 'de',
            language: 'German',
            sermons_available: 900,
            sermons_with_audio: 400,
            filename: 'de.zip',
            filesize: 40000000,
            checksum: 'ghi789',
        },
    ],
    bible: [],
};

describe('language-pack.service', () => {
    beforeEach(() => {
        createTestDb();
        vi.restoreAllMocks();
    });

    it('fetchManifest parses manifest correctly', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_MANIFEST),
        });

        const { fetchManifest } = await import('@main/services/language-pack.service');
        const manifest = await fetchManifest();

        expect(manifest.version).toBe(1);
        expect(manifest.languages).toHaveLength(3);
        expect(manifest.languages[0].code).toBe('en');
    });

    it('fetchManifest throws on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });

        const { fetchManifest } = await import('@main/services/language-pack.service');
        await expect(fetchManifest()).rejects.toThrow('Failed to fetch manifest');
    });

    it('getInstalledLanguages returns expected data', async () => {
        const { getInstalledLanguages } = await import('@main/services/language-pack.service');
        const installed = getInstalledLanguages();

        expect(installed).toHaveLength(2);
        expect(installed.map((l) => l.code).sort()).toEqual(['en', 'fr']);
        expect(installed.find((l) => l.code === 'en')!.sermonsCount).toBe(100);
        expect(installed.find((l) => l.code === 'fr')!.sermonsCount).toBe(50);
    });

    it('getDownloadableLanguages diffs against installed', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_MANIFEST),
        });

        const { getDownloadableLanguages } = await import('@main/services/language-pack.service');
        const downloadable = await getDownloadableLanguages();

        expect(downloadable).toHaveLength(3);

        const en = downloadable.find((l) => l.code === 'en')!;
        expect(en.installed).toBe(true);
        expect(en.sermonsAvailable).toBe(1200);

        const de = downloadable.find((l) => l.code === 'de')!;
        expect(de.installed).toBe(false);
        expect(de.filesize).toBe(40000000);
    });
});
