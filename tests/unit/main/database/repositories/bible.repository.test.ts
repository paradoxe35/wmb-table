import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTestBibleDb } from '../test-helpers';
import * as bibleRepo from '@main/database/repositories/bible.repository';

function insertVerse(
  sqlite: import('better-sqlite3').Database,
  data: {
    id: string;
    bookName: string;
    book: string;
    testament: string;
    chapter: string;
    verse: string;
    content: string;
  },
) {
  sqlite
    .prepare(
      `INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.bookName, data.book, data.testament, data.chapter, data.verse, data.content);
}

describe('bible.repository', () => {
  let bibleSqlite: import('better-sqlite3').Database;

  beforeEach(() => {
    createTestDb();
    const bible = createTestBibleDb();
    bibleSqlite = bible.sqlite;

    insertVerse(bibleSqlite, {
      id: 'v1',
      bookName: 'Genesis',
      book: 'gen',
      testament: 'OT',
      chapter: '1',
      verse: '1',
      content: 'In the beginning God created the heavens and the earth.',
    });
    insertVerse(bibleSqlite, {
      id: 'v2',
      bookName: 'Genesis',
      book: 'gen',
      testament: 'OT',
      chapter: '1',
      verse: '2',
      content: 'And the earth was without form, and void.',
    });
    insertVerse(bibleSqlite, {
      id: 'v3',
      bookName: 'John',
      book: 'jhn',
      testament: 'NT',
      chapter: '3',
      verse: '16',
      content: 'For God so loved the world.',
    });
  });

  it('getIndexes returns book index', () => {
    const indexes = bibleRepo.getIndexes();
    expect(indexes['Genesis']).toBeDefined();
    expect(indexes['Genesis'].book).toBe('gen');
    expect(indexes['John']).toBeDefined();
  });

  it('getBooks filters by book and chapter', () => {
    const books = bibleRepo.getBooks({ book: 'gen', chapter: '1' });
    expect(books).toHaveLength(2);
  });

  it('getBooks filters by book, chapter, and verse', () => {
    const books = bibleRepo.getBooks({ book: 'gen', chapter: '1', verse: '1' });
    expect(books).toHaveLength(1);
    expect(books[0].content).toContain('beginning');
  });

  it('search returns FTS5 results', () => {
    const result = bibleRepo.search('beginning', 1);
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].item.bookName).toBe('Genesis');
  });

  it('search pagination works', () => {
    const result = bibleRepo.search('God', 1);
    expect(result.total).toBe(2);
    expect(result.end).toBe(true);
  });
});
