import { eq, desc, and, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, getMainSqlite } from '../index';
import { sermonMetadata } from '../schema';
import type { SermonMeta } from '@shared/types';

export type { SermonMeta };

export interface UpsertSermonMeta {
    translationId: number;
    languageCode: string;
    sermonDate: string;
    title: string;
    enTitle?: string | null;
    audioLink?: string | null;
    pdfLink?: string | null;
    webLink?: string | null;
    dateLong?: string | null;
    paragraphCount: number;
}

function rowToSermonMeta(row: typeof sermonMetadata.$inferSelect): SermonMeta {
    return {
        id: row.id,
        translationId: row.translationId,
        languageCode: row.languageCode,
        sermonDate: row.sermonDate,
        title: row.title,
        enTitle: row.enTitle,
        audioLink: row.audioLink,
        pdfLink: row.pdfLink,
        webLink: row.webLink,
        dateLong: row.dateLong,
        paragraphCount: row.paragraphCount,
    };
}

export function getSermonList(langCode: string, options?: { year?: string }): SermonMeta[] {
    const db = getDb();
    let query = db
        .select()
        .from(sermonMetadata)
        .where(eq(sermonMetadata.languageCode, langCode))
        .orderBy(desc(sermonMetadata.sermonDate));

    if (options?.year) {
        query = db
            .select()
            .from(sermonMetadata)
            .where(
                and(
                    eq(sermonMetadata.languageCode, langCode),
                    sql`substr(${sermonMetadata.sermonDate}, 1, 2) = ${options.year}`,
                ),
            )
            .orderBy(desc(sermonMetadata.sermonDate));
    }

    return query.all().map(rowToSermonMeta);
}

export function getSermonMeta(translationId: number, langCode: string): SermonMeta | null {
    const row = getDb()
        .select()
        .from(sermonMetadata)
        .where(
            and(
                eq(sermonMetadata.translationId, translationId),
                eq(sermonMetadata.languageCode, langCode),
            ),
        )
        .get();
    return row ? rowToSermonMeta(row) : null;
}

export function getSermonsByYear(langCode: string): Record<string, SermonMeta[]> {
    const all = getSermonList(langCode);
    const grouped: Record<string, SermonMeta[]> = {};
    for (const sermon of all) {
        const year = sermon.sermonDate.substring(0, 2);
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(sermon);
    }
    return grouped;
}

export function getAvailableTranslations(
    translationId: number,
): { languageCode: string; title: string }[] {
    return getDb()
        .select({
            languageCode: sermonMetadata.languageCode,
            title: sermonMetadata.title,
        })
        .from(sermonMetadata)
        .where(eq(sermonMetadata.translationId, translationId))
        .all();
}

export function upsertMetadata(entries: UpsertSermonMeta[]): void {
    const sqlite = getMainSqlite();
    const BATCH_SIZE = 50;

    const stmt = sqlite.prepare(`
        INSERT OR REPLACE INTO sermon_metadata
            (id, translation_id, language_code, sermon_date, title, en_title,
             audio_link, pdf_link, web_link, date_long, paragraph_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const runBatch = sqlite.transaction((batch: UpsertSermonMeta[]) => {
        for (const e of batch) {
            // Check if row exists to preserve its id
            const existing = sqlite
                .prepare(
                    'SELECT id FROM sermon_metadata WHERE translation_id = ? AND language_code = ?',
                )
                .get(e.translationId, e.languageCode) as { id: string } | undefined;

            const id = existing?.id ?? randomUUID();
            stmt.run(
                id,
                e.translationId,
                e.languageCode,
                e.sermonDate,
                e.title,
                e.enTitle ?? null,
                e.audioLink ?? null,
                e.pdfLink ?? null,
                e.webLink ?? null,
                e.dateLong ?? null,
                e.paragraphCount,
            );
        }
    });

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        runBatch(batch);
    }
}

export function deleteByLanguage(langCode: string): void {
    getDb().delete(sermonMetadata).where(eq(sermonMetadata.languageCode, langCode)).run();
}

export function getLanguagesWithMetadata(): string[] {
    const rows = getDb()
        .selectDistinct({ languageCode: sermonMetadata.languageCode })
        .from(sermonMetadata)
        .all();
    return rows.map((r) => r.languageCode);
}
