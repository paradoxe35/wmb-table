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
    return bibleService
        .getBibleVersionsForLanguage(languageCode)
        .filter((version) => bibleService.isBibleAvailable(version))
        .map((version) => ({
            abbreviation: version.abbreviation,
            languageCode: version.langCode,
            name: version.name,
        }));
}

export function getPassage(input: {
    book: string;
    chapter: string;
    fromVerse?: string;
    toVerse?: string;
    abbreviation?: string;
    languageCode?: string;
}): BibleBook[] {
    const dbPath = resolveBiblePath(input.abbreviation, input.languageCode);
    if (!dbPath || !existsSync(dbPath)) return [];

    const db = new Database(dbPath, { readonly: true });
    try {
        if (!input.fromVerse) {
            const stmt = db.prepare(
                `SELECT id, book_name as bookName, book, testament, chapter, verse, content
                 FROM bible_verses
                 WHERE book = ? AND chapter = ?
                 ORDER BY CAST(verse as integer)`,
            );
            return stmt.all(input.book, input.chapter) as BibleBook[];
        }

        const stmt = db.prepare(
            `SELECT id, book_name as bookName, book, testament, chapter, verse, content
             FROM bible_verses
             WHERE book = ? AND chapter = ? AND CAST(verse as integer) BETWEEN ? AND ?
             ORDER BY CAST(verse as integer)`,
        );
        return stmt.all(
            input.book,
            input.chapter,
            Number(input.fromVerse),
            Number(input.toVerse ?? input.fromVerse),
        ) as BibleBook[];
    } finally {
        db.close();
    }
}

export function searchVerses(input: {
    query: string;
    abbreviation?: string;
    languageCode?: string;
    testament?: string;
    limit?: number;
}): BibleSearchResult {
    const maxResults = Math.min(input.limit ?? 20, 40);

    const emptyResult: BibleSearchResult = {
        end: true,
        itemsPerPage: maxResults,
        query: input.query,
        pageNumber: 1,
        total: 0,
        data: [],
    };

    const dbPath = resolveBiblePath(input.abbreviation, input.languageCode);
    if (!dbPath || !existsSync(dbPath)) return emptyResult;

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
    } finally {
        db.close();
    }
}
