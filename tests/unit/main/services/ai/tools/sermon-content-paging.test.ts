import { beforeEach, describe, expect, it, vi } from 'vitest';

interface IndexedSermon {
    date: number;
    sermonId: string | null;
    matchingParagraphs: number[];
}

let indexed: IndexedSermon[] = [];

const getInstalledLanguagesMock = vi.fn(() => ['fr']);

vi.mock('@main/services/tantivy.service', () => ({
    getInstalledLanguages: getInstalledLanguagesMock,
    searchSermons: vi.fn(async (_lang: string, _query: string, limit: number, offset: number) => ({
        hits: indexed.slice(offset, offset + limit).map((sermon, i) => ({
            translationId: 1,
            tantivySermonDate: sermon.date,
            score: 100 - offset - i,
            bestParagraphIndex: sermon.matchingParagraphs[0] ?? 1,
        })),
        total: indexed.length,
        totalIsExact: true,
    })),
    getMatchingParagraphs: vi.fn(
        async (_lang: string, _query: string, _translationId: number, date: number) =>
            (indexed.find((sermon) => sermon.date === date)?.matchingParagraphs ?? []).map(
                (paragraphIndex) => ({ paragraphIndex, snippet: `foi ${paragraphIndex}` }),
            ),
    ),
}));

vi.mock('@main/database/repositories/reference.repository', () => ({
    tantivyDatesToSermonIds: (dates: number[]) =>
        new Map(
            dates.flatMap((date) => {
                const sermonId = indexed.find((sermon) => sermon.date === date)?.sermonId;
                return sermonId ? [[date, [sermonId]] as const] : [];
            }),
        ),
}));

vi.mock('@main/services/reference-data.service', () => ({
    getSermonMeta: (translationId: number, _lang: string, sermonId: string) => ({
        sermonId,
        translationId,
        title: `Sermon ${sermonId}`,
    }),
}));

const { buildSermonTools } = await import('@main/services/ai/tools/sermon.tools');

interface ContentPage {
    error?: string;
    results: Array<{ sermonId: string }>;
    totalSermons: number;
    returned: number;
    hasMore: boolean;
    nextCursor?: string;
}

const tools = buildSermonTools('fr');

function search(input: Record<string, unknown>): Promise<ContentPage> {
    return tools.searchContent.execute(input) as Promise<ContentPage>;
}

async function collectAllPages(limit: number): Promise<ContentPage[]> {
    const pages = [await search({ query: 'la foi', limit })];
    while (pages.at(-1)?.nextCursor && pages.length < 50) {
        pages.push(await search({ cursor: pages.at(-1)?.nextCursor }));
    }
    return pages;
}

/** Every third sermon is dropped: odd ones have no sermon id, the others no matching line. */
function indexSermons(count: number): string[] {
    indexed = Array.from({ length: count }, (_, i) => {
        const dropped = i % 3 === 2;
        return {
            date: 1000 + i,
            sermonId: dropped && i % 2 === 1 ? null : `s-${i}`,
            matchingParagraphs: dropped && i % 2 === 0 ? [] : [i + 1],
        };
    });
    return indexed.filter((_, i) => i % 3 !== 2).map((sermon) => sermon.sermonId as string);
}

describe('searchContent paging when the service drops hits', () => {
    beforeEach(() => {
        getInstalledLanguagesMock.mockReturnValue(['fr']);
        indexed = [];
    });

    it('returns every kept sermon exactly once across pages', async () => {
        const kept = indexSermons(14);

        const pages = await collectAllPages(4);
        const ids = pages.flatMap((page) => page.results.map((item) => item.sermonId));

        expect(ids).toEqual(kept);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps the total stable and ends with a last page that has no cursor', async () => {
        indexSermons(14);

        const pages = await collectAllPages(4);

        expect(pages).toHaveLength(4);
        expect(pages.every((page) => page.totalSermons === 14)).toBe(true);
        expect(pages.at(-1)).toMatchObject({ hasMore: false, nextCursor: undefined });
        expect(pages.slice(0, -1).every((page) => page.hasMore)).toBe(true);
    });

    it('moves past a page whose hits were all dropped instead of stopping early', async () => {
        indexed = [
            { date: 1, sermonId: null, matchingParagraphs: [1] },
            { date: 2, sermonId: 's-2', matchingParagraphs: [] },
            { date: 3, sermonId: 's-3', matchingParagraphs: [4] },
        ];

        const pages = await collectAllPages(2);

        expect(pages[0]).toMatchObject({ results: [], hasMore: true });
        expect(pages.flatMap((page) => page.results.map((item) => item.sermonId))).toEqual(['s-3']);
    });

    it('returns an empty page without a cursor when nothing matches', async () => {
        const page = await search({ query: 'introuvable' });

        expect(page).toMatchObject({
            results: [],
            totalSermons: 0,
            returned: 0,
            hasMore: false,
            nextCursor: undefined,
        });
    });

    it('returns an empty last page for a cursor past the end', async () => {
        indexSermons(3);
        const first = await search({ query: 'la foi', limit: 2 });
        indexed = indexed.slice(0, 1);

        const past = await search({ cursor: first.nextCursor });

        expect(past).toMatchObject({ results: [], hasMore: false, nextCursor: undefined });
    });

    it('reports a language that is not installed', async () => {
        indexSermons(3);

        const page = await search({ query: 'la foi', languageCode: 'sw' });

        expect(page.error).toBe('Language "sw" is not installed. Available languages: fr.');
    });
});
