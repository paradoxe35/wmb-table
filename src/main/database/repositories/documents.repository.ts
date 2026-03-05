import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { customDocuments } from '../schema';
import type { CustomDocument } from '@shared/types';

export function getCustomDocuments(): CustomDocument[] {
    const rows = getDb().select().from(customDocuments).all();
    return rows.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        title: row.title,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    }));
}

export function createCustomDocument(documentId: string, title: string): CustomDocument {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
        .insert(customDocuments)
        .values({ id, documentId, title, createdAt: now, updatedAt: now })
        .run();
    return {
        id,
        documentId,
        title,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}

export function deleteCustomDocument(id: string): void {
    getDb().delete(customDocuments).where(eq(customDocuments.id, id)).run();
}
