import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInstalledLanguagesMock = vi.fn(() => ['fr']);
const getSermonListForLanguageMock = vi.fn();
const getSermonMetaMock = vi.fn();
const getTranslationsForSermonInLanguageMock = vi.fn();
const searchSermonsMock = vi.fn();
const getSermonParagraphsMock = vi.fn();

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
    getSermonParagraphs: getSermonParagraphsMock,
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonListForLanguage: getSermonListForLanguageMock,
    getSermonMeta: getSermonMetaMock,
    getTranslationsForSermonInLanguage: getTranslationsForSermonInLanguageMock,
}));

vi.mock('@main/services/search.service', () => ({
    searchSermons: searchSermonsMock,
}));

describe('sermon.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstalledLanguagesMock.mockReturnValue(['fr']);
        getTranslationsForSermonInLanguageMock.mockReturnValue([]);
        getSermonParagraphsMock.mockResolvedValue([]);
        getSermonMetaMock.mockImplementation(
            (translationId: number, _lang: string, sermonId: string) => ({
                sermonId,
                translationId,
                location: `Location ${translationId}`,
            }),
        );
    });

    it('paginates searchContent with nextCursor', async () => {
        searchSermonsMock.mockImplementation(async ({ offset, limit, query, mode, langCode }) => {
            expect(limit).toBe(2);
            expect(query).toBe('Dieu a dit');
            expect(mode).toBe('exact');
            expect(langCode).toBe('fr');

            if (offset === 0) {
                return {
                    matches: [
                        {
                            sermonId: '56-0101',
                            translationId: 1,
                            title: 'Premier',
                            snippets: [
                                { paragraphIndex: 11, snippet: 'Dieu a dit...' },
                                { paragraphIndex: 14, snippet: 'Encore...' },
                            ],
                        },
                        {
                            sermonId: '56-0102',
                            translationId: 2,
                            title: 'Deuxieme',
                            snippets: [{ paragraphIndex: 7, snippet: 'Dieu a dit encore...' }],
                        },
                    ],
                    total: 3,
                    totalIsExact: true,
                };
            }

            expect(offset).toBe(2);
            return {
                matches: [
                    {
                        sermonId: '56-0103',
                        translationId: 3,
                        title: 'Troisieme',
                        snippets: [{ paragraphIndex: 5, snippet: 'Fin...' }],
                    },
                ],
                total: 3,
                totalIsExact: true,
            };
        });

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const first = (await tools.searchContent.execute({
            query: 'Dieu a dit',
            limit: 2,
        })) as {
            returned: number;
            hasMore: boolean;
            nextCursor?: string;
            totalSermons: number;
            results: Array<{
                sermonId: string;
                translationId: number;
                languageCode: string;
                location?: string;
                matches: Array<{ paragraphNumber: number; snippet: string; wmbUrl: string }>;
            }>;
        };

        expect(first.totalSermons).toBe(3);
        expect(first.returned).toBe(2);
        expect(first.hasMore).toBe(true);
        expect(first.nextCursor).toBeTypeOf('string');
        expect(first.results.map((item) => item.sermonId)).toEqual(['56-0101', '56-0102']);
        expect(first.results[0].languageCode).toBe('fr');
        expect(first.results[0].location).toBe('Location 1');
        expect(first.results[0].matches[0]).toEqual({
            paragraphNumber: 11,
            snippet: 'Dieu a dit...',
            wmbUrl: 'wmb://sermon/56-0101/fr/1/11',
        });

        const second = (await tools.searchContent.execute({
            cursor: first.nextCursor,
        })) as {
            returned: number;
            hasMore: boolean;
            results: Array<{ sermonId: string }>;
        };

        expect(second.returned).toBe(1);
        expect(second.hasMore).toBe(false);
        expect(second.results.map((item) => item.sermonId)).toEqual(['56-0103']);
        expect(searchSermonsMock).toHaveBeenCalledTimes(2);
    });

    it('paginates searchSermons metadata results with nextCursor', async () => {
        getSermonListForLanguageMock.mockReturnValue([
            {
                sermonId: '56-0101',
                translationId: 1,
                title: 'Message Alpha',
                enTitle: 'Alpha',
                location: 'Paris',
                cityState: 'Paris',
                dateMs: Date.UTC(1956, 0, 1),
            },
            {
                sermonId: '56-0102',
                translationId: 2,
                title: 'Message Beta',
                enTitle: 'Beta',
                location: 'Lyon',
                cityState: 'Lyon',
                dateMs: Date.UTC(1956, 0, 2),
            },
            {
                sermonId: '56-0103',
                translationId: 3,
                title: 'Message Gamma',
                enTitle: 'Gamma',
                location: 'Marseille',
                cityState: 'Marseille',
                dateMs: Date.UTC(1956, 0, 3),
            },
        ]);

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const first = (await tools.searchSermons.execute({
            query: 'Message',
            limit: 2,
        })) as {
            total: number;
            returned: number;
            hasMore: boolean;
            nextCursor?: string;
            results: Array<{ sermonId: string }>;
        };

        expect(first.total).toBe(3);
        expect(first.returned).toBe(2);
        expect(first.hasMore).toBe(true);
        expect(first.results.map((item) => item.sermonId)).toEqual(['56-0101', '56-0102']);
        expect(first.results[0].languageCode).toBe('fr');

        const second = (await tools.searchSermons.execute({
            cursor: first.nextCursor,
        })) as {
            returned: number;
            hasMore: boolean;
            results: Array<{ sermonId: string }>;
        };

        expect(second.returned).toBe(1);
        expect(second.hasMore).toBe(false);
        expect(second.results.map((item) => item.sermonId)).toEqual(['56-0103']);
    });

    describe('what searchSermons matches a query against', () => {
        const SERMON = {
            sermonId: '65-0801',
            translationId: 7,
            title: 'Le Dieu de cet âge mauvais',
            enTitle: 'The God Of This Evil Age',
            location: 'Jeffersonville, Indiana',
            cityState: 'Jeffersonville IN',
            dateMs: Date.UTC(1965, 7, 1),
        };

        async function search(query: string) {
            getSermonListForLanguageMock.mockReturnValue([SERMON]);
            const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
            return (await buildSermonTools('fr').searchSermons.execute({ query })) as {
                results: Array<{ sermonId: string }>;
            };
        }

        it.each([
            ['title', 'dieu age mauvais'],
            ['title without its accents', 'age mauvais'],
            ['english title', 'evil age'],
            ['location', 'jeffersonville indiana'],
            ['city and state', 'jeffersonville in'],
            ['sermon id', '65-0801'],
            ['sermon id without the dash', '650801'],
            ['iso date', '1965-08-01'],
        ])('finds it by %s', async (_field, query) => {
            const result = await search(query);
            expect(result.results.map((item) => item.sermonId)).toEqual(['65-0801']);
        });

        it('does not find it by words it does not carry', async () => {
            const result = await search('tucson arizona');
            expect(result.results).toEqual([]);
        });
    });

    it('refuses a query with no searchable word instead of returning every sermon', async () => {
        getSermonListForLanguageMock.mockReturnValue([
            { sermonId: '56-0101', translationId: 1, title: 'Message Alpha', dateMs: 0 },
            { sermonId: '56-0102', translationId: 2, title: 'Message Beta', dateMs: 0 },
        ]);

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const result = (await tools.searchSermons.execute({ query: '...' })) as { error?: string };

        expect(result.error).toContain('no searchable word');
    });

    it('keeps a one-character query searchable where a character is a whole word', async () => {
        getSermonListForLanguageMock.mockReturnValue([
            { sermonId: '56-0101', translationId: 1, title: '中国的信息', dateMs: 0 },
            { sermonId: '56-0102', translationId: 2, title: 'Message Beta', dateMs: 0 },
        ]);

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const result = (await tools.searchSermons.execute({ query: '\u4e2d' })) as {
            results: Array<{ sermonId: string }>;
        };

        expect(result.results.map((item) => item.sermonId)).toEqual(['56-0101']);
    });

    it('puts the sermon the query names ahead of the ones that merely mention it', async () => {
        getSermonListForLanguageMock.mockReturnValue([
            { sermonId: '56-0101', translationId: 1, title: 'La sagesse contre la foi', dateMs: 0 },
            { sermonId: '56-0102', translationId: 2, title: 'Parfois il faut attendre', dateMs: 0 },
            { sermonId: '56-0103', translationId: 3, title: 'Foi parfaite', dateMs: 0 },
        ]);

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const result = (await tools.searchSermons.execute({ query: 'foi' })) as {
            results: Array<{ sermonId: string }>;
        };

        expect(result.results.map((item) => item.sermonId)).toEqual([
            '56-0103',
            '56-0101',
            '56-0102',
        ]);
    });

    it('returns resolved and fallback translation ids when getSermonContent falls back', async () => {
        getSermonMetaMock.mockImplementation(
            (translationId: number, _lang: string, sermonId: string) => {
                if (translationId === 9) {
                    return null;
                }

                return {
                    sermonId,
                    translationId,
                    title: 'Message Alpha',
                    dateMs: Date.UTC(1956, 0, 1),
                    location: `Location ${translationId}`,
                };
            },
        );
        getTranslationsForSermonInLanguageMock.mockReturnValue([
            {
                sermonId: '56-0101',
                translationId: 3,
                title: 'Message Alpha',
                dateMs: Date.UTC(1956, 0, 1),
            },
        ]);
        getSermonParagraphsMock.mockResolvedValue([
            { paragraphIndex: 0, content: 'Premier paragraphe' },
            { paragraphIndex: 1, content: 'Deuxieme paragraphe' },
        ]);

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');

        const result = (await tools.getSermonContent.execute({
            sermonId: '56-0101',
            translationId: 9,
        })) as {
            meta: { translationId: number; languageCode: string };
            requestedTranslationId?: number;
            resolvedTranslationId?: number;
            fallbackTranslationId?: number;
            translationWarning?: string;
            paragraphs: Array<{ paragraphNumber: number; content: string; wmbUrl: string }>;
        };

        expect(result.meta.translationId).toBe(3);
        expect(result.meta.languageCode).toBe('fr');
        expect(result.requestedTranslationId).toBe(9);
        expect(result.resolvedTranslationId).toBe(3);
        expect(result.fallbackTranslationId).toBe(3);
        expect(result.translationWarning).toContain('Requested translation 9 was not found');
        expect(result.paragraphs).toEqual([
            {
                paragraphNumber: 0,
                content: 'Premier paragraphe',
                wmbUrl: 'wmb://sermon/56-0101/fr/3/0',
            },
            {
                paragraphNumber: 1,
                content: 'Deuxieme paragraphe',
                wmbUrl: 'wmb://sermon/56-0101/fr/3/1',
            },
        ]);
    });

    it('does not hand back a cursor when a content page resolves to no usable hits', async () => {
        // Tantivy reports more results, but every hit on this page was filtered out.
        searchSermonsMock.mockResolvedValue({ matches: [], total: 120, totalIsExact: false });

        const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');
        const tools = buildSermonTools('fr');
        const result = (await tools.searchContent.execute({ query: 'amour' })) as {
            hasMore: boolean;
            nextCursor?: string;
        };

        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBeUndefined();
    });
});
