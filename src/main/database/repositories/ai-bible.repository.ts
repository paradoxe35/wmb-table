import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import * as bibleService from '@main/services/bible.service';
import { normalizeBibleAbbreviation } from '@shared/types';
import { strNormalize } from '@shared/searchable';
import type { BibleBook, BibleSearchResult } from '@shared/types';

export interface ResolvedBibleVersion {
    abbreviation: string;
    languageCode: string;
    name: string;
}

function resolveVersionSource(
    abbreviation?: string,
    languageCode?: string,
): (ResolvedBibleVersion & { dbPath: string }) | null {
    const abbr = normalizeBibleAbbreviation(abbreviation);
    const versions = bibleService.getAllBibleVersions();

    const version =
        (abbr
            ? versions.find((v) => v.abbreviation === abbr)
            : languageCode
              ? versions.find(
                    (v) => v.langCode === languageCode && bibleService.isBibleAvailable(v),
                )
              : bibleService.getActiveVersion()) ?? null;

    if (!version) return null;

    const dbPath = bibleService.resolveBiblePath(version);
    if (!existsSync(dbPath)) return null;

    return {
        abbreviation: version.abbreviation,
        languageCode: version.langCode,
        name: version.name,
        dbPath,
    };
}

export function resolveBibleVersion(
    abbreviation?: string,
    languageCode?: string,
): ResolvedBibleVersion | null {
    const resolved = resolveVersionSource(abbreviation, languageCode);
    if (!resolved) return null;

    return {
        abbreviation: resolved.abbreviation,
        languageCode: resolved.languageCode,
        name: resolved.name,
    };
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
    const source = resolveVersionSource(input.abbreviation, input.languageCode);
    if (!source) {
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

    const db = new Database(source.dbPath, { readonly: true });
    try {
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
            const rows = db
                .prepare(
                    `SELECT id, book_name as bookName, book, testament, chapter, verse, content
                     FROM bible_verses
                     WHERE book = ? AND chapter = ?
                     ORDER BY CAST(verse as integer)`,
                )
                .all(bookCode, chapter) as BibleBook[];
            if (rows.length === 0) {
                return {
                    error: `No verses found for chapter ${chapter}. The book may have fewer chapters.`,
                };
            }
            return rows;
        }

        const rows = db
            .prepare(
                `SELECT id, book_name as bookName, book, testament, chapter, verse, content
                 FROM bible_verses
                 WHERE book = ? AND chapter = ? AND CAST(verse as integer) BETWEEN ? AND ?
                 ORDER BY CAST(verse as integer)`,
            )
            .all(bookCode, chapter, Number(fromVerse), Number(toVerse ?? fromVerse)) as BibleBook[];
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
    const trimmed = book.trim();

    // Try exact match on book code first (e.g. "01O", "43N")
    const byCode = db
        .prepare('SELECT book FROM bible_verses WHERE book = ? LIMIT 1')
        .get(trimmed) as { book: string } | undefined;
    if (byCode) return byCode.book;

    // Normalize input the same way we do for sermon search (strips accents + lowercases)
    const normalized = strNormalize(trimmed);

    // Load all distinct book names and match with normalization
    const allBooks = db.prepare('SELECT DISTINCT book, book_name FROM bible_verses').all() as {
        book: string;
        book_name: string;
    }[];

    // Exact normalized match (e.g. "revelation" matches "Révélation", "apocalypse" matches "Apocalypse")
    const exactMatch = allBooks.find((r) => strNormalize(r.book_name) === normalized);
    if (exactMatch) return exactMatch.book;

    // Prefix normalized match (e.g. "rev" matches "Révélation", "apo" matches "Apocalypse")
    const prefixMatch = allBooks.find((r) => strNormalize(r.book_name).startsWith(normalized));
    if (prefixMatch) return prefixMatch.book;

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

    const source = resolveVersionSource(input.abbreviation, input.languageCode);
    if (!source) {
        return {
            error: `No Bible found${input.abbreviation ? ` for abbreviation "${input.abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
        };
    }

    const db = new Database(source.dbPath, { readonly: true });
    try {
        // Try FTS first
        const ftsResult = searchWithFts(db, input.query, input.testament, maxResults);
        if (ftsResult.total > 0) return ftsResult;

        // Fallback: normalize and filter with LIKE (accent-insensitive)
        return searchWithNormalize(db, input.query, input.testament, maxResults);
    } catch (err) {
        return {
            error: `Bible search failed: ${err instanceof Error ? err.message : String(err)}. Try simplifying your query.`,
        };
    } finally {
        db.close();
    }
}

function searchWithFts(
    db: Database.Database,
    query: string,
    testament: string | undefined,
    limit: number,
): BibleSearchResult {
    const testamentFilter = testament ? ` AND bv.testament = ?` : '';
    const params: (string | number)[] = [query];
    if (testament) params.push(testament);

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
        .all(...params, limit) as BibleBook[];

    return {
        end: rows.length >= total,
        itemsPerPage: limit,
        query,
        pageNumber: 1,
        total,
        data: rows.map((item, i) => ({ item, matches: [], refIndex: i })),
    };
}

function searchWithNormalize(
    db: Database.Database,
    query: string,
    testament: string | undefined,
    limit: number,
): BibleSearchResult {
    const words = query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .map((w) => strNormalize(w));

    if (words.length === 0) {
        return { end: true, itemsPerPage: limit, query, pageNumber: 1, total: 0, data: [] };
    }

    // Build SQL LIKE conditions for each normalized word.
    // We register a custom strNormalize function in SQLite so normalization
    // happens in the DB engine, avoiding loading all rows into JS.
    db.function('str_normalize', (val: unknown) =>
        typeof val === 'string' ? strNormalize(val) : '',
    );

    const testamentFilter = testament ? ` AND testament = ?` : '';
    const likeConditions = words.map(() => `str_normalize(content) LIKE ?`).join(' AND ');
    const likeParams = words.map((w) => `%${w}%`);
    const params = [...likeParams, ...(testament ? [testament] : [])];

    const countResult = db
        .prepare(
            `SELECT COUNT(*) as total FROM bible_verses
             WHERE ${likeConditions}${testamentFilter}`,
        )
        .get(...params) as { total: number } | undefined;
    const total = countResult?.total ?? 0;

    const rows = db
        .prepare(
            `SELECT id, book_name as bookName, book, testament, chapter, verse, content
             FROM bible_verses
             WHERE ${likeConditions}${testamentFilter}
             LIMIT ?`,
        )
        .all(...params, limit) as BibleBook[];

    return {
        end: rows.length >= total,
        itemsPerPage: limit,
        query,
        pageNumber: 1,
        total,
        data: rows.map((item, i) => ({ item, matches: [], refIndex: i })),
    };
}
