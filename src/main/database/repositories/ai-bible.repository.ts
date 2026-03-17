import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabaseDir } from '@main/lib/app-paths';
import * as bibleService from '@main/services/bible.service';
import type { BibleBook, BibleSearchResult } from '@shared/types';

function resolveBiblePath(abbreviation?: string, languageCode?: string): string | null {
    const versions = bibleService.getAllBibleVersions();
    const version =
        (abbreviation
            ? versions.find((item) => item.abbreviation === abbreviation)
            : languageCode
              ? versions.find(
                    (item) => item.langCode === languageCode && bibleService.isBibleAvailable(item),
                )
              : bibleService.getActiveVersion()) ?? null;

    if (!version) return null;

    if (version.type === 'local') {
        const resourceBase = app.isPackaged
            ? join(process.resourcesPath, 'database')
            : join(__dirname, '../../../../resources/database');
        return join(resourceBase, version.fileName);
    }

    return join(getDatabaseDir(), 'bibles', version.fileName);
}

export function getAvailableVersions(languageCode: string) {
    const versions = bibleService
        .getBibleVersionsForLanguage(languageCode)
        .filter((version) => bibleService.isBibleAvailable(version))
        .map((version) => ({
            abbreviation: version.abbreviation,
            languageCode: version.langCode,
            name: version.name,
        }));

    if (versions.length === 0) {
        return { error: `No Bible versions available for language "${languageCode}".` };
    }
    return versions;
}

export function getPassage(input: {
    book: string;
    chapter: string;
    fromVerse?: string;
    toVerse?: string;
    abbreviation?: string;
    languageCode?: string;
}): BibleBook[] | { error: string } {
    const dbPath = resolveBiblePath(input.abbreviation, input.languageCode);
    if (!dbPath || !existsSync(dbPath)) {
        return {
            error: `No Bible found${input.abbreviation ? ` for abbreviation "${input.abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
        };
    }

    const chapter = input.chapter.replace(/\D/g, '');
    if (!chapter) {
        return { error: `Invalid chapter: "${input.chapter}". Provide a number (e.g. "3").` };
    }

    const fromVerse = input.fromVerse?.replace(/\D/g, '');
    const toVerse = input.toVerse?.replace(/\D/g, '');
    if (input.fromVerse && !fromVerse) {
        return {
            error: `Invalid verse number: "${input.fromVerse}". Provide a number (e.g. "16").`,
        };
    }

    const db = new Database(dbPath, { readonly: true });
    try {
        // Resolve book: try book_name (case-insensitive) first, then book code
        const bookCode = resolveBookCode(db, input.book);
        if (!bookCode) {
            const available = db
                .prepare(
                    'SELECT DISTINCT book_name FROM bible_verses ORDER BY CAST(book AS integer)',
                )
                .all() as { book_name: string }[];
            const names = available.map((r) => r.book_name);
            return {
                error: `Book "${input.book}" not found. Available books: ${names.slice(0, 10).join(', ')}${names.length > 10 ? `, ... (${names.length} total)` : ''}.`,
            };
        }

        if (!fromVerse) {
            const stmt = db.prepare(
                `SELECT id, book_name as bookName, book, testament, chapter, verse, content
                 FROM bible_verses
                 WHERE book = ? AND chapter = ?
                 ORDER BY CAST(verse as integer)`,
            );
            const rows = stmt.all(bookCode, chapter) as BibleBook[];
            if (rows.length === 0) {
                return {
                    error: `No verses found for chapter ${chapter}. The book may have fewer chapters.`,
                };
            }
            return rows;
        }

        const stmt = db.prepare(
            `SELECT id, book_name as bookName, book, testament, chapter, verse, content
             FROM bible_verses
             WHERE book = ? AND chapter = ? AND CAST(verse as integer) BETWEEN ? AND ?
             ORDER BY CAST(verse as integer)`,
        );
        const rows = stmt.all(
            bookCode,
            chapter,
            Number(fromVerse),
            Number(toVerse ?? fromVerse),
        ) as BibleBook[];
        if (rows.length === 0) {
            return {
                error: `No verses found for chapter ${chapter}, verses ${fromVerse}-${toVerse ?? fromVerse}.`,
            };
        }
        return rows;
    } finally {
        db.close();
    }
}

/** Resolve a book name or code to the internal book code used in the DB. */
function resolveBookCode(db: Database.Database, book: string): string | null {
    // Try exact match on book code first (e.g. "01O", "43N")
    const byCode = db.prepare('SELECT book FROM bible_verses WHERE book = ? LIMIT 1').get(book) as
        | { book: string }
        | undefined;
    if (byCode) return byCode.book;

    // Try case-insensitive match on book_name (e.g. "Genesis", "Jean", "Matthieu")
    const byName = db
        .prepare('SELECT book FROM bible_verses WHERE book_name = ? COLLATE NOCASE LIMIT 1')
        .get(book) as { book: string } | undefined;
    if (byName) return byName.book;

    // Try partial match (e.g. "Rev" matches "Revelation", "Apo" matches "Apocalypse")
    const byPartial = db
        .prepare('SELECT book FROM bible_verses WHERE book_name LIKE ? COLLATE NOCASE LIMIT 1')
        .get(`${book}%`) as { book: string } | undefined;
    if (byPartial) return byPartial.book;

    return null;
}

export function searchVerses(input: {
    query: string;
    abbreviation?: string;
    languageCode?: string;
    testament?: string;
    limit?: number;
}): BibleSearchResult | { error: string } {
    const maxResults = Math.min(input.limit ?? 20, 40);

    const dbPath = resolveBiblePath(input.abbreviation, input.languageCode);
    if (!dbPath || !existsSync(dbPath)) {
        return {
            error: `No Bible found${input.abbreviation ? ` for abbreviation "${input.abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
        };
    }

    const db = new Database(dbPath, { readonly: true });
    try {
        const testamentFilter = input.testament ? ` AND bv.testament = ?` : '';
        const params: (string | number)[] = [input.query];
        if (input.testament) params.push(input.testament);

        const countResult = db
            .prepare(
                `SELECT COUNT(*) as total FROM bible_verses_fts
                 JOIN bible_verses bv ON bv.rowid = bible_verses_fts.rowid
                 WHERE bible_verses_fts MATCH ?${testamentFilter}`,
            )
            .get(...params) as { total: number } | undefined;
        const total = countResult?.total ?? 0;

        const rows = db
            .prepare(
                `SELECT bv.id, bv.book_name as bookName, bv.book, bv.testament,
                        bv.chapter, bv.verse, bv.content
                 FROM bible_verses_fts
                 JOIN bible_verses bv ON bv.rowid = bible_verses_fts.rowid
                 WHERE bible_verses_fts MATCH ?${testamentFilter}
                 ORDER BY rank
                 LIMIT ?`,
            )
            .all(...params, maxResults) as BibleBook[];

        return {
            end: rows.length >= total,
            itemsPerPage: maxResults,
            query: input.query,
            pageNumber: 1,
            total,
            data: rows.map((item, i) => ({ item, matches: [], refIndex: i })),
        };
    } catch (err) {
        return {
            error: `Bible search failed: ${err instanceof Error ? err.message : String(err)}. Try simplifying your query.`,
        };
    } finally {
        db.close();
    }
}
