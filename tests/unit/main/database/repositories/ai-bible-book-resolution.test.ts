import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { resolveBookCode } from '@main/database/repositories/ai-bible.repository';

const BOOKS: [string, string][] = [
    ['19O', 'Psaumes'],
    ['22O', 'Cantique des cantiques'],
    ['43N', 'Jean'],
    ['46N', '1 Corinthiens'],
    ['62N', '1 Jean'],
    ['63N', '2 Jean'],
    ['66N', 'Apocalypse'],
];

let db: Database.Database;

beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE bible_verses (
        book TEXT NOT NULL, book_name TEXT NOT NULL,
        chapter TEXT NOT NULL, verse TEXT NOT NULL, content TEXT NOT NULL
    )`);
    const insert = db.prepare(
        'INSERT INTO bible_verses (book, book_name, chapter, verse, content) VALUES (?, ?, ?, ?, ?)',
    );
    for (const [code, name] of BOOKS) insert.run(code, name, '1', '1', 'x');
});

afterEach(() => db.close());

describe('resolveBookCode', () => {
    it.each([
        ['43N', '43N'],
        ['Jean', '43N'],
        ['jean', '43N'],
        ['1 Jean', '62N'],
        ['Apocalypse', '66N'],
        ['apo', '66N'],
        ['psaume', '19O'],
        ['cantique', '22O'],
    ])('resolves %s the way it always has', (book, expected) => {
        expect(resolveBookCode(db, book)).toBe(expected);
    });

    it.each([
        ['1jean', '62N'],
        ['1Jean', '62N'],
        ['2jean', '63N'],
        ['1corinthiens', '46N'],
        ['cantiquedescantiques', '22O'],
    ])('resolves %s, written without the spaces', (book, expected) => {
        expect(resolveBookCode(db, book)).toBe(expected);
    });

    it('still finds nothing for a book that is not there', () => {
        expect(resolveBookCode(db, 'Enoch')).toBeNull();
        expect(resolveBookCode(db, 'zzz')).toBeNull();
    });
});
