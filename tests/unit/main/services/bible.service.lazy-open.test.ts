import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
    pragma: vi.fn(),
    close: vi.fn(),
};

const DatabaseMock = vi.fn(function MockDatabase() {
    return mockDb;
});

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: () => '/tmp',
        getAppPath: () => '/tmp',
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('better-sqlite3', () => ({
    default: DatabaseMock,
}));

vi.mock('node:fs', () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((path: string) => {
        if (path.endsWith('bible-index.json')) {
            return JSON.stringify([
                {
                    langCode: 'en',
                    abbreviation: 'kjv',
                    name: 'KJV',
                    fileName: 'kjv.sqlite',
                    type: 'local',
                },
            ]);
        }
        return '[]';
    }),
    writeFileSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
    rm: vi.fn(async () => {}),
}));

vi.mock('@main/lib/app-paths', () => ({
    getDatabaseDir: () => '/tmp',
}));

vi.mock('@main/lib/github', () => ({
    githubDownload: vi.fn(),
    resolveGitHubDownloadRequest: vi.fn(),
}));

vi.mock('@main/lib/resumable-download', () => ({
    downloadResumableFile: vi.fn(),
    replaceFileAtomically: vi.fn(),
}));

vi.mock('@main/lib/simple-cache', () => ({
    SimpleCache: class {
        get() {
            return null;
        }
        getStale() {
            return null;
        }
        set() {
            return;
        }
    },
}));

describe('bible.service lazy active db opening', () => {
    beforeEach(() => {
        vi.resetModules();
        DatabaseMock.mockClear();
        mockDb.pragma.mockClear();
        mockDb.close.mockClear();
    });

    it('validates the active Bible version eagerly but does not keep it resident until first access', async () => {
        const bibleService = await import('@main/services/bible.service');

        expect(bibleService.switchBibleVersion('kjv')?.abbreviation).toBe('kjv');
        expect(DatabaseMock).toHaveBeenCalledTimes(1);
        expect(mockDb.close).toHaveBeenCalledTimes(1);
        expect(bibleService.peekActiveBibleDb()).toBeNull();

        const db = bibleService.getActiveBibleDb();

        expect(db).toBe(mockDb);
        expect(DatabaseMock).toHaveBeenCalledTimes(2);
        expect(mockDb.pragma).toHaveBeenCalledWith(expect.stringContaining('mmap_size'));
        expect(mockDb.pragma).toHaveBeenCalledWith(expect.stringContaining('cache_size'));
    });
});
