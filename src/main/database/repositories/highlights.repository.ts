import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { highlights } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type { HighlightItem } from '@shared/types';

function toHighlightItem(row: typeof highlights.$inferSelect): HighlightItem {
    return {
        id: row.id,
        documentTitle: row.documentTitle,
        sermonId: row.sermonId,
        paragraphIndex: row.paragraphIndex,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
        textSnippet: row.textSnippet,
        color: row.color,
        comment: row.comment ?? undefined,
        documentType: row.documentType as 'sermon' | 'custom',
        translationId: row.translationId,
        languageCode: row.languageCode,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function getByDocument(documentTitle: string, sermonId: string): HighlightItem[] {
    const rows = getDb()
        .select()
        .from(highlights)
        .where(and(eq(highlights.documentTitle, documentTitle), eq(highlights.sermonId, sermonId)))
        .all();
    return rows.map(toHighlightItem);
}

export function create(data: {
    documentTitle: string;
    sermonId: string;
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    textSnippet: string;
    color: string;
    comment?: string;
    documentType: 'sermon' | 'custom';
    translationId: number;
    languageCode: string;
}): HighlightItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    const values = {
        id,
        documentTitle: data.documentTitle,
        sermonId: data.sermonId,
        paragraphIndex: data.paragraphIndex,
        startOffset: data.startOffset,
        endOffset: data.endOffset,
        textSnippet: data.textSnippet,
        color: data.color,
        comment: data.comment ?? null,
        documentType: data.documentType,
        translationId: data.translationId,
        languageCode: data.languageCode,
        createdAt: now,
        updatedAt: now,
    };
    getDb().insert(highlights).values(values).run();
    logChange('highlights', id, 'SAVE', values);
    return toHighlightItem({ ...values, comment: values.comment });
}

export function update(
    id: string,
    data: { color?: string; comment?: string },
): HighlightItem | null {
    const db = getDb();
    const existing = db.select().from(highlights).where(eq(highlights.id, id)).get();
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated = {
        color: data.color ?? existing.color,
        comment: data.comment !== undefined ? data.comment : existing.comment,
        updatedAt: now,
    };
    db.update(highlights).set(updated).where(eq(highlights.id, id)).run();

    const row = { ...existing, ...updated };
    logChange('highlights', id, 'SAVE', row);
    return toHighlightItem(row);
}

export function deleteHighlight(id: string): void {
    getDb().delete(highlights).where(eq(highlights.id, id)).run();
    logChange('highlights', id, 'DELETE', { id });
}
