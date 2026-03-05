import { eq, and } from 'drizzle-orm';
import { getBibleDb, getBibleSqlite } from '../index';
import { bibleVerses } from '../bible-schema';
import type { BibleBook, BibleIndex, BibleSearchResult, BookRequest } from '@shared/types';

function toBook(row: typeof bibleVerses.$inferSelect): BibleBook {
  return {
    id: row.id,
    bookName: row.bookName,
    book: row.book,
    testament: row.testament,
    chapter: row.chapter,
    verse: row.verse,
    content: row.content,
  };
}

export function getIndexes(): BibleIndex {
  const db = getBibleSqlite();
  const rows = db
    .prepare(
      `SELECT book_name, book, testament,
              GROUP_CONCAT(DISTINCT chapter) as chapters,
              GROUP_CONCAT(DISTINCT verse) as verses
       FROM bible_verses
       GROUP BY book_name, book, testament`,
    )
    .all() as Array<{
    book_name: string;
    book: string;
    testament: string;
    chapters: string;
    verses: string;
  }>;

  const index: BibleIndex = {};
  for (const row of rows) {
    index[row.book_name] = {
      book: row.book,
      chapters: row.chapters,
      verses: row.verses,
      testament: row.testament,
    };
  }
  return index;
}

export function getBooks(request: BookRequest): BibleBook[] {
  const db = getBibleDb();
  let conditions = [eq(bibleVerses.book, request.book), eq(bibleVerses.chapter, request.chapter)];
  if (request.verse) {
    conditions.push(eq(bibleVerses.verse, request.verse));
  }
  const rows = db
    .select()
    .from(bibleVerses)
    .where(and(...conditions))
    .all();
  return rows.map(toBook);
}

export function search(query: string, pageNumber: number): BibleSearchResult {
  const itemsPerPage = 20;
  const offset = (pageNumber - 1) * itemsPerPage;
  const sqlite = getBibleSqlite();

  // Count total matches
  const countResult = sqlite
    .prepare(`SELECT COUNT(*) as total FROM bible_verses_fts WHERE bible_verses_fts MATCH ?`)
    .get(query) as { total: number } | undefined;
  const total = countResult?.total ?? 0;

  // Get page of results
  const rows = sqlite
    .prepare(
      `SELECT bv.* FROM bible_verses_fts
       JOIN bible_verses bv ON bv.rowid = bible_verses_fts.rowid
       WHERE bible_verses_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`,
    )
    .all(query, itemsPerPage, offset) as Array<{
    id: string;
    book_name: string;
    book: string;
    testament: string;
    chapter: string;
    verse: string;
    content: string;
  }>;

  const data = rows.map((row, i) => ({
    item: {
      id: row.id,
      bookName: row.book_name,
      book: row.book,
      testament: row.testament,
      chapter: row.chapter,
      verse: row.verse,
      content: row.content,
    },
    matches: [],
    refIndex: offset + i,
  }));

  return {
    end: offset + itemsPerPage >= total,
    itemsPerPage,
    query,
    pageNumber,
    total,
    data,
  };
}
