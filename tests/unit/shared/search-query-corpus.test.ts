import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { searchList, simpleRegExp, strNormalize } from '@shared/searchable';

const DATA_SQLITE_PATH = resolve(__dirname, '../../../resources/database/data.sqlite');

const identity = (title: string) => title;

let db: Database.Database;
let titles: Record<string, string[]>;

beforeAll(() => {
    db = new Database(DATA_SQLITE_PATH, { readonly: true });
    const rows = (sql: string, ...params: unknown[]) =>
        (db.prepare(sql).all(...params) as { title: string }[]).map((row) => row.title);

    titles = {
        // English carries no translation rows: its titles live on the sermon itself.
        en: rows('SELECT title FROM sermon WHERE title IS NOT NULL'),
        fr: rows(
            `SELECT t.title FROM translation t
             JOIN language l ON l.isar_id = t.language_id
             WHERE l.code = ? AND t.title IS NOT NULL`,
            'fr',
        ),
    };
});

afterAll(() => db.close());

/** The matcher the sidebar used before: one global regex reused across the whole list. */
function previousMatcher(list: string[], query: string): string[] {
    const regex = simpleRegExp(query);
    return list.filter((title) => {
        regex.lastIndex = 0;
        return regex.test(strNormalize(title));
    });
}

const QUERIES = [
    'foi',
    'la foi',
    'suis moi',
    'suis-moi',
    'esprit',
    'saint esprit',
    'baptême',
    'bapteme',
    'jesus',
    'pere',
    'eglise',
    'sept sceaux',
    'faith',
    'the seven seals',
];

describe('the real sermon corpus', () => {
    it('has titles to search in both bundled languages', () => {
        expect(titles.fr.length).toBeGreaterThan(1000);
        expect(titles.en.length).toBeGreaterThan(1000);
    });

    it.each(QUERIES)('never loses a title the previous matcher found for "%s"', (query) => {
        for (const list of [titles.fr, titles.en]) {
            const found = new Set(searchList(list, query, identity));
            for (const title of previousMatcher(list, query)) {
                expect(found.has(title), `"${title}" disappeared from "${query}"`).toBe(true);
            }
        }
    });

    it.each(QUERIES)('returns only titles that really carry every word of "%s"', (query) => {
        const words = query
            .split(/[^\p{Alphabetic}\p{N}]+/u)
            .filter(Boolean)
            .map(strNormalize);

        for (const title of searchList(titles.fr, query, identity)) {
            const haystack = strNormalize(title).replace(/[^\p{Alphabetic}\p{N}]+/gu, '');
            for (const word of words) {
                expect(haystack.includes(word), `"${title}" does not carry "${word}"`).toBe(true);
            }
        }
    });

    it('finds the sermon the reported query could not reach', () => {
        expect(searchList(titles.fr, 'suis moi', identity).length).toBeGreaterThanOrEqual(3);
        expect(previousMatcher(titles.fr, 'suis moi')).toHaveLength(0);
    });

    it('finds a title written with punctuation the query leaves out', () => {
        expect(searchList(titles.fr, 'leglise', identity).length).toBeGreaterThan(0);
    });

    it('ranks a title that opens with the query above one that merely contains it', () => {
        const ranked = searchList(titles.fr, 'la foi', identity);
        const opensWithQuery = (title: string) => strNormalize(title).startsWith('la foi');

        expect(ranked.length).toBeGreaterThan(5);
        expect(opensWithQuery(ranked[0])).toBe(true);
        expect(opensWithQuery(ranked[ranked.length - 1])).toBe(false);
    });

    it('stays fast enough to filter on every keystroke', () => {
        const started = performance.now();
        for (const query of QUERIES) searchList(titles.fr, query, identity);
        const perQuery = (performance.now() - started) / QUERIES.length;

        expect(perQuery).toBeLessThan(50);
    });
});
