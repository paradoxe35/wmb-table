import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabaseDir } from '@main/lib/app-paths';
import * as bibleService from '@main/services/bible.service';
import type { BibleBook } from '@shared/types';

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
