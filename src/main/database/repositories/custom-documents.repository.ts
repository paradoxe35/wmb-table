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
            createdAt: customDocuments.createdAt,
            updatedAt: customDocuments.updatedAt,
        })
        .from(customDocuments)
        .all();
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    }));
}

export function createCustomDocument(title: string, content: string): CustomDocument {
    const id = randomUUID();
    const documentId = randomUUID();
    const now = new Date().toISOString();
    getDb()
        .insert(customDocuments)
        .values({ id, documentId, title, content, createdAt: now, updatedAt: now })
        .run();
    logChange('custom_documents', id, 'SAVE', {
        id,
        documentId,
        title,
        content,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        title,
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
        })
        .from(customDocuments)
        .where(eq(customDocuments.id, id))
        .get();
    if (!row) return null;
    return { id: row.id, title: row.title, content: row.content };
}

export function deleteCustomDocument(id: string): void {
    getDb().delete(customDocuments).where(eq(customDocuments.id, id)).run();
    logChange('custom_documents', id, 'DELETE', { id });
}
