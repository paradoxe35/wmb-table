import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { highlights } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type {
    DocumentType,
    HighlightCreateData,
    HighlightItem,
    HighlightUpdateData,
} from '@shared/types';

function toHighlightItem(row: typeof highlights.$inferSelect): HighlightItem {
    return {
        id: row.id,
        groupId: row.groupId,
        documentTitle: row.documentTitle,
        sermonId: row.sermonId,
        paragraphIndex: row.paragraphIndex,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
        textSnippet: row.textSnippet,
        color: row.color,
        comment: row.comment ?? undefined,
        documentType: row.documentType as DocumentType,
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

export function create(data: HighlightCreateData): HighlightItem[] {
    const groupId = randomUUID();
    const now = new Date().toISOString();
    const results: HighlightItem[] = [];

    for (const p of data.paragraphs) {
        const id = randomUUID();
        const values = {
            id,
            groupId,
            documentTitle: data.documentTitle,
            sermonId: data.sermonId,
            paragraphIndex: p.paragraphIndex,
            startOffset: p.startOffset,
            endOffset: p.endOffset,
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
        results.push(toHighlightItem({ ...values, comment: values.comment }));
    }

    return results;
}

export function update(id: string, data: HighlightUpdateData): HighlightItem | null {
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
    const db = getDb();
    // Find the highlight to check if it belongs to a group
    const existing = db.select().from(highlights).where(eq(highlights.id, id)).get();
    if (!existing) return;

    if (existing.groupId) {
        // Delete all highlights in the same group
        const group = db
            .select()
            .from(highlights)
            .where(eq(highlights.groupId, existing.groupId))
            .all();
        for (const row of group) {
            db.delete(highlights).where(eq(highlights.id, row.id)).run();
            logChange('highlights', row.id, 'DELETE', { id: row.id });
        }
    } else {
        db.delete(highlights).where(eq(highlights.id, id)).run();
        logChange('highlights', id, 'DELETE', { id });
    }
}
