import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { customDocuments } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type { CustomDocument, CustomDocumentContent } from '@shared/types';

export function getCustomDocuments(): CustomDocument[] {
    const rows = getDb()
        .select({
            id: customDocuments.id,
            title: customDocuments.title,
            sermonId: customDocuments.sermonId,
            languageCode: customDocuments.languageCode,
            createdAt: customDocuments.createdAt,
            updatedAt: customDocuments.updatedAt,
        })
        .from(customDocuments)
        .all();
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        sermonId: row.sermonId || new Date().toISOString().slice(0, 10),
        languageCode: row.languageCode ?? '',
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    }));
}

export function createCustomDocument(
    title: string,
    content: string,
    languageCode: string,
): CustomDocument {
    const db = getDb();
    const existing = db
        .select()
        .from(customDocuments)
        .where(eq(customDocuments.title, title))
        .get();
    if (existing) {
        throw new Error('Un document avec ce nom existe déjà.');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const sermonId = now.slice(0, 10);
    db.insert(customDocuments)
        .values({ id, title, content, sermonId, languageCode, createdAt: now, updatedAt: now })
        .run();
    logChange('custom_documents', id, 'SAVE', {
        id,
        title,
        content,
        sermonId,
        languageCode,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        title,
        sermonId,
        languageCode,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}

export function getCustomDocumentContent(id: string): CustomDocumentContent | null {
    const row = getDb()
        .select({
            id: customDocuments.id,
            title: customDocuments.title,
            content: customDocuments.content,
            languageCode: customDocuments.languageCode,
        })
        .from(customDocuments)
        .where(eq(customDocuments.id, id))
        .get();
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        languageCode: row.languageCode ?? '',
    };
}

export function updateCustomDocumentLanguage(id: string, languageCode: string): void {
    const now = new Date().toISOString();
    getDb()
        .update(customDocuments)
        .set({ languageCode, updatedAt: now })
        .where(eq(customDocuments.id, id))
        .run();
    logChange('custom_documents', id, 'SAVE', { id, languageCode, updatedAt: now });
}

export function deleteCustomDocument(id: string): void {
    getDb().delete(customDocuments).where(eq(customDocuments.id, id)).run();
    logChange('custom_documents', id, 'DELETE', { id });
}
