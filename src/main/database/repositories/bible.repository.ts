import { eq, and } from 'drizzle-orm';
import { bibleVerses } from '../bible-schema';
import type { BibleBook, BibleIndex, BibleSearchResult, BookRequest } from '@shared/types';
import * as bibleService from '@main/services/bible.service';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as bibleSchema from '../bible-schema';

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

function getSqlite() {
    return bibleService.getActiveBibleDb();
}

function getDrizzle() {
    const sqlite = getSqlite();
    if (!sqlite) return null;
    return drizzle(sqlite, { schema: bibleSchema });
}

export function getIndexes(): BibleIndex {
    const sqlite = getSqlite();
    if (!sqlite) return {};

    const rows = sqlite
        .prepare(
            `SELECT book_name, book, testament,
              GROUP_CONCAT(DISTINCT chapter) as chapters,
              GROUP_CONCAT(DISTINCT verse) as verses
       FROM bible_verses
       GROUP BY book_name, book, testament
       ORDER BY book`,
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
    const db = getDrizzle();
    if (!db) return [];

    const conditions = [
        eq(bibleVerses.book, request.book),
        eq(bibleVerses.chapter, request.chapter),
    ];
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

function sanitizeFtsQuery(raw: string): string {
    return raw
        .replace(/[""(){}*:^~]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter((w) => w.length >= 2)
        .map((w) => `"${w}"`)
        .join(' ');
}

export function search(query: string, pageNumber: number, testament?: string): BibleSearchResult {
    const itemsPerPage = 20;
    const offset = (pageNumber - 1) * itemsPerPage;
    const sqlite = getSqlite();

    const emptyResult: BibleSearchResult = {
        end: true,
        itemsPerPage,
        query,
        pageNumber,
        total: 0,
        data: [],
    };

    if (!sqlite) return emptyResult;

    const ftsQuery = sanitizeFtsQuery(query);
    if (!ftsQuery) return emptyResult;

    const testamentFilter = testament ? ` AND bv.testament = ?` : '';
    const params: (string | number)[] = [ftsQuery];
    if (testament) params.push(testament);

    // Count total matches
    const countResult = sqlite
        .prepare(
            `SELECT COUNT(*) as total FROM bible_verses_fts
       JOIN bible_verses bv ON bv.rowid = bible_verses_fts.rowid
       WHERE bible_verses_fts MATCH ?${testamentFilter}`,
        )
        .get(...params) as { total: number } | undefined;
    const total = countResult?.total ?? 0;

    // Get page of results
    const pageParams: (string | number)[] = [...params, itemsPerPage, offset];
    const rows = sqlite
        .prepare(
            `SELECT bv.* FROM bible_verses_fts
       JOIN bible_verses bv ON bv.rowid = bible_verses_fts.rowid
       WHERE bible_verses_fts MATCH ?${testamentFilter}
       ORDER BY rank
       LIMIT ? OFFSET ?`,
        )
        .all(...pageParams) as Array<{
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
