import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { sanitizeFtsQuery } from '@main/database/fts-query';

const NASTY_QUERIES = [
    'Saint-Esprit',
    "l'amour de Dieu",
    'l’amour de Dieu',
    'Jean 3:16',
    'book_name:Jean',
    '"tant aimé"',
    'a"b"c',
    '« Qui t’a dit »',
    'foi (grande)',
    'amour?',
    'cieux*',
    '^début ~fin',
    '{content}: dieu',
    'NOT dieu',
    'dieu AND',
    'OR',
    'NEAR(dieu amour, 5)',
    'and or not near',
    '-',
    '- -',
    '+dieu -amour',
    '...',
    "'''",
    '""',
    '',
    '   ',
    'é è ê ç',
    '\u0000dieu',
    'x'.repeat(10_000),
];

describe('sanitizeFtsQuery', () => {
    const db = new Database(':memory:');
    db.exec("CREATE VIRTUAL TABLE t USING fts5(content, book_name, tokenize='unicode61')");

    it.each(NASTY_QUERIES)('never produces an FTS5 syntax error for %j', (query) => {
        const match = sanitizeFtsQuery(query);
        if (!match) return;
        expect(() => db.prepare('SELECT count(*) FROM t WHERE t MATCH ?').get(match)).not.toThrow();
    });

    it('quotes each word so operators and column names are plain text', () => {
        expect(sanitizeFtsQuery('NOT book_name:Jean')).toBe('"NOT" "book_name" "Jean"');
    });

    it('returns an empty string when nothing searchable is left', () => {
        expect(sanitizeFtsQuery(' " : * a ')).toBe('');
    });
});
