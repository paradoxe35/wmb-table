import Database from 'better-sqlite3';
import log from 'electron-log';
import { existsSync } from 'node:fs';
import * as bibleService from '@main/services/bible.service';
import { normalizeBibleAbbreviation } from '@shared/types';
import { strNormalize, stripSeparators } from '@shared/searchable';
import type { BibleBook, BibleSearchResult } from '@shared/types';
import { sanitizeFtsQuery } from '../fts-query';

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

interface BookRow {
    book: string;
    book_name: string;
}

function listBooks(db: Database.Database): BookRow[] {
    return db
        .prepare(
            'SELECT DISTINCT book, book_name FROM bible_verses ORDER BY CAST(book AS integer), book',
        )
        .all() as BookRow[];
}

/** A single letter is a prefix of several books ("J": Josué, Job, Jean…), so it names none. */
const MIN_BOOK_NAME_LENGTH = 2;

/** Resolve a book name or code to the internal book code used in the DB. */
export function resolveBookCode(db: Database.Database, book: string): string | null {
    const trimmed = book.trim();

    // Try exact match on book code first (e.g. "01O", "43N")
    const byCode = db
        .prepare('SELECT book FROM bible_verses WHERE book = ? LIMIT 1')
        .get(trimmed) as { book: string } | undefined;
    if (byCode) return byCode.book;

    // Normalize input the same way we do for sermon search (strips accents + lowercases)
    const normalized = strNormalize(trimmed);
    const joined = stripSeparators(normalized);
    if (joined.length < MIN_BOOK_NAME_LENGTH) return null;

    const allBooks = listBooks(db);

    // Exact normalized match (e.g. "revelation" matches "Révélation", "apocalypse" matches "Apocalypse")
    const exactMatch = allBooks.find((r) => strNormalize(r.book_name) === normalized);
    if (exactMatch) return exactMatch.book;

    // Prefix normalized match (e.g. "rev" matches "Révélation", "apo" matches "Apocalypse")
    const prefixMatch = allBooks.find((r) => strNormalize(r.book_name).startsWith(normalized));
    if (prefixMatch) return prefixMatch.book;

    // Last resort, for a query that ran the words together: "1jean" for "1 Jean"
    const joinedMatch = allBooks.find((r) =>
        stripSeparators(strNormalize(r.book_name)).startsWith(joined),
    );
    if (joinedMatch) {
        return joinedMatch.book;
    }

    return null;
}

const MAX_PAGE_SIZE = 40;

interface SearchPage {
    query: string;
    testament: string | undefined;
    limit: number;
    offset: number;
}

export function searchVerses(input: {
    query: string;
    abbreviation?: string;
    languageCode?: string;
    testament?: string;
    limit?: number;
    offset?: number;
}): BibleSearchResult | { error: string } {
    const page: SearchPage = {
        query: input.query,
        testament: input.testament,
        limit: Math.max(1, Math.min(input.limit ?? 20, MAX_PAGE_SIZE)),
        offset: Math.max(0, input.offset ?? 0),
    };

    const source = resolveVersionSource(input.abbreviation, input.languageCode);
    if (!source) {
        return {
            error: `No Bible found${input.abbreviation ? ` for abbreviation "${input.abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
        };
    }

    const db = new Database(source.dbPath, { readonly: true });
    try {
        const ftsResult = trySearchWithFts(db, page);
        if (ftsResult && ftsResult.total > 0) return ftsResult;

        return searchWithNormalize(db, page);
    } catch (err) {
        return {
            error: `Bible search failed: ${err instanceof Error ? err.message : String(err)}. Try simplifying your query.`,
        };
    } finally {
        db.close();
    }
}

function toSearchResult(page: SearchPage, rows: BibleBook[], total: number): BibleSearchResult {
    return {
        end: page.offset + rows.length >= total,
        itemsPerPage: page.limit,
        query: page.query,
        pageNumber: Math.floor(page.offset / page.limit) + 1,
        total,
        data: rows.map((item, i) => ({ item, matches: [], refIndex: i })),
    };
}

/** A failed MATCH must not end the search: the LIKE fallback can still answer. */
function trySearchWithFts(db: Database.Database, page: SearchPage): BibleSearchResult | null {
    const match = sanitizeFtsQuery(page.query);
    if (!match) return null;

    try {
        return searchWithFts(db, match, page);
    } catch (err) {
        log.warn('AI Bible FTS search failed, falling back to LIKE:', err);
        return null;
    }
}

function searchWithFts(db: Database.Database, match: string, page: SearchPage): BibleSearchResult {
    const testamentFilter = page.testament ? ` AND bv.testament = ?` : '';
    const params: (string | number)[] = [match];
    if (page.testament) params.push(page.testament);

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
             ORDER BY rank, bv.rowid
             LIMIT ? OFFSET ?`,
        )
        .all(...params, page.limit, page.offset) as BibleBook[];

    return toSearchResult(page, rows, total);
}

/** SQLite rejects a much longer LIKE chain: "Expression tree is too large". */
const MAX_LIKE_TERMS = 32;
const TYPOGRAPHIC_APOSTROPHES = /[‘’ʼ]/g;

function normalizeForLike(text: string): string {
    return strNormalize(text).replace(TYPOGRAPHIC_APOSTROPHES, "'");
}

function toLikePattern(word: string): string {
    const escaped = normalizeForLike(word).replace(/[\\%_]/g, (char) => `\\${char}`);
    return `%${escaped}%`;
}

function searchWithNormalize(db: Database.Database, page: SearchPage): BibleSearchResult {
    const patterns = page.query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .slice(0, MAX_LIKE_TERMS)
        .map(toLikePattern);

    if (patterns.length === 0) {
        return toSearchResult(page, [], 0);
    }

    // Registering the normalizer in SQLite keeps the filtering in the engine,
    // instead of loading every verse into JS.
    db.function('str_normalize', (val: unknown) =>
        typeof val === 'string' ? normalizeForLike(val) : '',
    );

    const testamentFilter = page.testament ? ` AND testament = ?` : '';
    const likeConditions = patterns
        .map(() => `str_normalize(content) LIKE ? ESCAPE '\\'`)
        .join(' AND ');
    const params = [...patterns, ...(page.testament ? [page.testament] : [])];

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
             ORDER BY rowid
             LIMIT ? OFFSET ?`,
        )
        .all(...params, page.limit, page.offset) as BibleBook[];

    return toSearchResult(page, rows, total);
}
