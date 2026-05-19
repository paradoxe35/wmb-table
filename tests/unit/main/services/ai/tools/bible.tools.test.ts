import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInstalledLanguagesMock = vi.fn(() => ['fr', 'en']);
const getAvailableVersionsMock = vi.fn();
const resolveBibleVersionMock = vi.fn();
const getPassageMock = vi.fn();
const searchVersesMock = vi.fn();

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
}));

vi.mock('@main/database/repositories/ai-bible.repository', () => ({
    getAvailableVersions: getAvailableVersionsMock,
    resolveBibleVersion: resolveBibleVersionMock,
    getPassage: getPassageMock,
    searchVerses: searchVersesMock,
}));

describe('bible.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstalledLanguagesMock.mockReturnValue(['fr', 'en']);
    });

    it('returns only clean bible version fields', async () => {
        getAvailableVersionsMock.mockReturnValue([
            {
                abbreviation: 'lsg',
                languageCode: 'fr',
                name: 'Louis Segond',
                type: 'local',
                fileName: 'bible.fr-lsg.sqlite',
            },
        ]);

        const { buildBibleTools } = await import('@main/services/ai/tools/bible.tools');
        const tools = buildBibleTools('fr');
        const result = (await tools.getBibleVersions.execute({ languageCode: 'fr' })) as Array<{
            abbreviation: string;
            languageCode: string;
            name: string;
            type?: string;
            fileName?: string;
        }>;

        expect(result).toEqual([
            {
                abbreviation: 'lsg',
                languageCode: 'fr',
                name: 'Louis Segond',
            },
        ]);
        expect(result[0]).not.toHaveProperty('type');
        expect(result[0]).not.toHaveProperty('fileName');
    });

    it('returns a clean passage response with exact wmb link fields', async () => {
        resolveBibleVersionMock.mockReturnValue({
            abbreviation: 'lsg',
            languageCode: 'fr',
            name: 'Louis Segond',
        });
        getPassageMock.mockReturnValue([
            {
                id: 'verse-1',
                bookName: 'Jean',
                book: '43N',
                testament: 'N',
                chapter: '3',
                verse: '16',
                content: 'Car Dieu a tant aime le monde...',
            },
            {
                id: 'verse-2',
                bookName: 'Jean',
                book: '43N',
                testament: 'N',
                chapter: '3',
                verse: '17',
                content: 'Dieu, en effet, n a pas envoye...',
            },
        ]);

        const { buildBibleTools } = await import('@main/services/ai/tools/bible.tools');
        const tools = buildBibleTools('fr');
        const result = (await tools.getBiblePassage.execute({
            book: 'Jean',
            chapter: '3',
            fromVerse: '16',
            toVerse: '17',
        })) as {
            bookCode: string;
            bookName: string;
            chapter: string;
            fromVerse: string;
            toVerse: string;
            bibleVersionAbbreviation: string;
            verseCount: number;
            verses: Array<Record<string, unknown>>;
        };

        expect(result).toEqual({
            bookCode: '43N',
            bookName: 'Jean',
            chapter: '3',
            fromVerse: '16',
            toVerse: '17',
            bibleVersionAbbreviation: 'lsg',
            verseCount: 2,
            verses: [
                {
                    bookCode: '43N',
                    bookName: 'Jean',
                    chapter: '3',
                    verse: '16',
                    testament: 'N',
                    bibleVersionAbbreviation: 'lsg',
                    content: 'Car Dieu a tant aime le monde...',
                    wmbUrl: 'wmb://bible/43N/3/16/lsg/Jean',
                },
                {
                    bookCode: '43N',
                    bookName: 'Jean',
                    chapter: '3',
                    verse: '17',
                    testament: 'N',
                    bibleVersionAbbreviation: 'lsg',
                    content: 'Dieu, en effet, n a pas envoye...',
                    wmbUrl: 'wmb://bible/43N/3/17/lsg/Jean',
                },
            ],
        });
        expect(result.verses[0]).not.toHaveProperty('book');
        expect(result.verses[0]).not.toHaveProperty('id');
    });

    it('returns a clean bible search response without repository wrapper fields', async () => {
        resolveBibleVersionMock.mockReturnValue({
            abbreviation: 'kjv',
            languageCode: 'en',
            name: 'King James Version',
        });
        searchVersesMock.mockReturnValue({
            end: false,
            itemsPerPage: 10,
            query: 'love',
            pageNumber: 1,
            total: 2,
            data: [
                {
                    item: {
                        id: 'verse-1',
                        bookName: 'John',
                        book: '43N',
                        testament: 'N',
                        chapter: '3',
                        verse: '16',
                        content: 'For God so loved the world...',
                    },
                    matches: [{ text: 'loved' }],
                    refIndex: 0,
                },
                {
                    item: {
                        id: 'verse-2',
                        bookName: '1 John',
                        book: '62N',
                        testament: 'N',
                        chapter: '4',
                        verse: '8',
                        content: 'God is love.',
                    },
                    matches: [{ text: 'love' }],
                    refIndex: 1,
                },
            ],
        });

        const { buildBibleTools } = await import('@main/services/ai/tools/bible.tools');
        const tools = buildBibleTools('en');
        const result = (await tools.searchBible.execute({
            query: 'love',
            languageCode: 'en',
            limit: 10,
        })) as Record<string, unknown>;

        expect(result).toEqual({
            query: 'love',
            bibleVersionAbbreviation: 'kjv',
            total: 2,
            returned: 2,
            hasMore: false,
            results: [
                {
                    bookCode: '43N',
                    bookName: 'John',
                    chapter: '3',
                    verse: '16',
                    testament: 'N',
                    bibleVersionAbbreviation: 'kjv',
                    content: 'For God so loved the world...',
                    wmbUrl: 'wmb://bible/43N/3/16/kjv/John',
                },
                {
                    bookCode: '62N',
                    bookName: '1 John',
                    chapter: '4',
                    verse: '8',
                    testament: 'N',
                    bibleVersionAbbreviation: 'kjv',
                    content: 'God is love.',
                    wmbUrl: 'wmb://bible/62N/4/8/kjv/1%20John',
                },
            ],
        });
        expect(result).not.toHaveProperty('data');
        expect(result).not.toHaveProperty('itemsPerPage');
        expect(result).not.toHaveProperty('pageNumber');
        expect(result).not.toHaveProperty('end');
    });
});
