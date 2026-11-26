import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createBibleFixture,
    removeBibleFixture,
    setActiveFixtureVersion,
} from '../../../../helpers/bible-fixture';

vi.mock(
    '@main/services/bible.service',
    async () => (await import('../../../../helpers/bible-fixture')).fakeBibleService,
);

const { searchVerses, getPassage, getAvailableVersions, resolveBibleVersion } =
    await import('@main/database/repositories/ai-bible.repository');

type SearchOutcome = ReturnType<typeof searchVerses>;

function hits(result: SearchOutcome) {
    if ('error' in result) throw new Error(`Expected hits, got error: ${result.error}`);
    return result;
}

function references(result: SearchOutcome): string[] {
    return hits(result).data.map(({ item }) => `${item.bookName} ${item.chapter}:${item.verse}`);
}

beforeAll(createBibleFixture);
afterAll(removeBibleFixture);
beforeEach(() => setActiveFixtureVersion('lsg'));

describe('searchVerses query forms', () => {
    it.each([
        ['Saint-Esprit', ['Actes 2:4', 'Romains 5:5']],
        ['saint-esprit', ['Actes 2:4', 'Romains 5:5']],
        ['SAINT-ESPRIT', ['Actes 2:4', 'Romains 5:5']],
        ["l'amour de Dieu", ['Romains 5:5']],
        ['l’amour de Dieu', ['Romains 5:5']],
        ["Qui t'a dit que tu étais nu ?", ['Genèse 3:11']],
        ['« Qui t’a dit »', ['Genèse 3:11']],
        ['"tant aimé"', ['Jean 3:16']],
        ['etais nu', ['Genèse 3:11']],
        ['ÉTAIS NU', ['Genèse 3:11']],
        ['Éternel', ['Genèse 3:11']],
        ['créa (cieux)', ['Genèse 1:1']],
        ['cieux*', ['Genèse 1:1']],
        ['content:cieux', []],
        ['book_name:Jean', []],
        ['^cieux ~terre', ['Genèse 1:1']],
        ['Fortifie-toi', ['Josué 1:9']],
        ['s’appelait Job', ['Job 1:1']],
        ["s'appelait Job", ['Job 1:1']],
    ])('finds %s', (query, expected) => {
        expect(references(searchVerses({ query }))).toEqual(expected);
    });

    it.each(['NOT man', 'not man', 'man NOT', 'god AND', 'OR god', 'NEAR man', 'near(god man)'])(
        'treats FTS keywords in %s as plain words',
        (query) => {
            const result = searchVerses({ query, abbreviation: 'kjv' });
            expect(result).not.toHaveProperty('error');
        },
    );

    it('finds a verse containing the word "not" without treating it as an operator', () => {
        expect(references(searchVerses({ query: 'NOT a man', abbreviation: 'kjv' }))).toEqual([
            'Numbers 23:19',
        ]);
    });

    it.each(['Jean 3:16', '???', '...', "'''", '-', '- -', '""', '«»', 'a', '()', '*', ':'])(
        'returns an empty page for %s instead of an error',
        (query) => {
            const result = hits(searchVerses({ query }));
            expect(result.total).toBe(0);
            expect(result.data).toEqual([]);
            expect(result.end).toBe(true);
        },
    );

    it('survives a very long query', () => {
        const query = Array.from({ length: 2000 }, (_, index) => `mot${index}`).join(' ');
        const result = hits(searchVerses({ query }));
        expect(result.total).toBe(0);
    });

    it('survives a very long query that also needs the fallback', () => {
        const query = `heur ${'x'.repeat(5000)}`;
        expect(hits(searchVerses({ query })).total).toBe(0);
    });

    it('keeps the query as the model wrote it in the result', () => {
        expect(hits(searchVerses({ query: 'Saint-Esprit' })).query).toBe('Saint-Esprit');
    });

    it('filters by testament', () => {
        expect(references(searchVerses({ query: 'Dieu', testament: 'O' }))).toEqual([
            'Genèse 1:1',
            'Genèse 3:11',
        ]);
    });
});

describe('searchVerses accent-insensitive fallback', () => {
    it('finds a word part that FTS cannot match', () => {
        const result = hits(searchVerses({ query: 'heur', limit: 5 }));
        expect(result.total).toBe(60);
        expect(references(result)[0]).toBe('Psaumes 119:1');
    });

    it('ignores accents and apostrophe style', () => {
        expect(references(searchVerses({ query: "repan l'amou" }))).toEqual(['Romains 5:5']);
        expect(references(searchVerses({ query: 'éte donn' }))).toEqual(['Romains 5:5']);
    });

    it('treats LIKE wildcards in the query as plain text', () => {
        expect(hits(searchVerses({ query: 'uni_ue' })).total).toBe(0);
        expect(hits(searchVerses({ query: 'Fil%' })).total).toBe(0);
        expect(hits(searchVerses({ query: 'Fil' })).total).toBe(2);
    });
});

describe('searchVerses pagination', () => {
    it.each([
        ['FTS', 'Heureux'],
        ['fallback', 'heur'],
    ])('pages through %s results with a stable total', (_path, query) => {
        const first = hits(searchVerses({ query, limit: 25 }));
        const second = hits(searchVerses({ query, limit: 25, offset: 25 }));
        const last = hits(searchVerses({ query, limit: 25, offset: 50 }));

        expect([first.total, second.total, last.total]).toEqual([60, 60, 60]);
        expect([first.data.length, second.data.length, last.data.length]).toEqual([25, 25, 10]);
        expect([first.end, second.end, last.end]).toEqual([false, false, true]);
        expect([first.pageNumber, second.pageNumber, last.pageNumber]).toEqual([1, 2, 3]);

        const ids = [...first.data, ...second.data, ...last.data].map(({ item }) => item.id);
        expect(new Set(ids).size).toBe(60);
    });

    it('returns an empty last page past the end', () => {
        const result = hits(searchVerses({ query: 'Heureux', limit: 20, offset: 60 }));
        expect(result.total).toBe(60);
        expect(result.data).toEqual([]);
        expect(result.end).toBe(true);
    });

    it('caps the page size at 40', () => {
        expect(hits(searchVerses({ query: 'Heureux', limit: 500 })).data).toHaveLength(40);
    });
});

describe('version resolution', () => {
    it('uses the active version when nothing is asked for', () => {
        expect(resolveBibleVersion()?.abbreviation).toBe('lsg');
    });

    it('uses the asked language even when another version is active', () => {
        expect(resolveBibleVersion(undefined, 'en')?.abbreviation).toBe('kjv');
    });

    it('returns null for a language whose Bible is not downloaded', () => {
        expect(resolveBibleVersion(undefined, 'es')).toBeNull();
        expect(resolveBibleVersion('rv')).toBeNull();
    });

    it('lists the languages that do have a Bible when one is missing', () => {
        expect(getAvailableVersions('es')).toEqual({
            error: 'No Bible versions available for language "es". Bibles are installed for: fr, en.',
        });
    });

    it('searches the English Bible by language', () => {
        expect(references(searchVerses({ query: 'Holy Ghost', languageCode: 'en' }))).toEqual([
            'Acts 2:4',
        ]);
    });
});

describe('getPassage', () => {
    function verses(result: ReturnType<typeof getPassage>): string[] {
        if ('error' in result) throw new Error(result.error);
        return result.map((verse) => `${verse.chapter}:${verse.verse}`);
    }

    it('returns a verse range', () => {
        expect(
            verses(getPassage({ book: 'Jean', chapter: 3, verses: { from: 16, to: 18 } })),
        ).toEqual(['3:16', '3:17', '3:18']);
    });

    it('returns the whole chapter in verse order', () => {
        const result = verses(getPassage({ book: '19O', chapter: 119 }));
        expect(result).toHaveLength(60);
        expect(result.slice(0, 3)).toEqual(['119:1', '119:2', '119:3']);
    });

    it('explains a chapter that does not exist', () => {
        expect(getPassage({ book: 'Jean', chapter: 99 })).toEqual({
            error: 'No verses found for chapter 99. The book may have fewer chapters.',
        });
    });

    it('explains verses that do not exist', () => {
        expect(getPassage({ book: 'Jean', chapter: 3, verses: { from: 40, to: 41 } })).toEqual({
            error: 'No verses found for chapter 3, verses 40-41.',
        });
    });

    it('reads the English Bible by language while French is active', () => {
        expect(
            getPassage({
                book: 'John',
                chapter: 3,
                verses: { from: 16, to: 16 },
                languageCode: 'en',
            }),
        ).toMatchObject([{ content: expect.stringContaining('For God so loved') }]);
    });
});
