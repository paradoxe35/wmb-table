import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import log from 'electron-log';
import { getDb } from '../index';
import { subjects, subjectItems } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type {
    DocumentIdentity,
    SubjectDocumentPreview,
    SubjectDocument,
    SubjectDocumentItem,
    DocumentHtmlTree,
    ParagraphReference,
} from '@shared/types';

function safeJsonParse<T>(raw: string, fallback: T): T {
    try {
        return JSON.parse(raw);
    } catch (err) {
        log.warn('JSON parse failed in subjects repository:', err);
        return fallback;
    }
}

function toSubjectItem(row: typeof subjectItems.$inferSelect): SubjectDocumentItem {
    return {
        id: row.id,
        subjectId: row.subjectId,
        documentTitle: row.documentTitle,
        documentHtmlTree: safeJsonParse(row.documentHtmlTree, { tree: [] }),
        textContent: row.textContent,
        documentPreview: row.documentPreview
            ? safeJsonParse<SubjectDocumentPreview | undefined>(row.documentPreview, undefined)
            : undefined,
        documentIdentity: safeJsonParse<DocumentIdentity>(row.documentIdentity, {
            documentType: 'custom',
            customDocumentId: '',
        }),
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

/** List subjects without loading their references (lightweight). */
export function getAllSummary(): { id: string; name: string; date: string }[] {
    return getDb()
        .select({ id: subjects.id, name: subjects.name, date: subjects.date })
        .from(subjects)
        .orderBy(desc(subjects.createdAt))
        .all();
}

export function getAll(): SubjectDocument[] {
    const db = getDb();
    const subjectRows = db.select().from(subjects).orderBy(desc(subjects.createdAt)).all();
    if (subjectRows.length === 0) {
        return [];
    }

    // Single query for ALL items, then group by subjectId in JS
    const allItems = db.select().from(subjectItems).all();
    const itemsBySubject = new Map<string, (typeof subjectItems.$inferSelect)[]>();
    for (const item of allItems) {
        const list = itemsBySubject.get(item.subjectId);
        if (list) {
            list.push(item);
        } else {
            itemsBySubject.set(item.subjectId, [item]);
        }
    }

    return subjectRows.map((row) => ({
        id: row.id,
        name: row.name,
        date: row.date,
        active: false,
        documents: (itemsBySubject.get(row.id) ?? []).map(toSubjectItem),
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    }));
}

export function getById(id: string): SubjectDocument | null {
    const db = getDb();
    const row = db.select().from(subjects).where(eq(subjects.id, id)).get();
    if (!row) {
        return null;
    }
    const items = db.select().from(subjectItems).where(eq(subjectItems.subjectId, row.id)).all();
    return {
        id: row.id,
        name: row.name,
        date: row.date,
        active: false,
        documents: items.map(toSubjectItem),
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function create(name: string): SubjectDocument {
    const db = getDb();
    const existing = db.select().from(subjects).where(eq(subjects.name, name)).get();
    if (existing) {
        throw new Error('Un sujet avec ce nom existe déjà.');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const date = new Date().toLocaleDateString();
    db.insert(subjects)
        .values({ id, name, date, active: true, createdAt: now, updatedAt: now })
        .run();
    logChange('subjects', id, 'SAVE', {
        id,
        name,
        date,
        active: true,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        name,
        date,
        active: true,
        documents: [],
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}

export function rename(id: string, newName: string): void {
    const db = getDb();
    const existing = db.select().from(subjects).where(eq(subjects.name, newName)).get();
    if (existing && existing.id !== id) {
        throw new Error('Un sujet avec ce nom existe déjà.');
    }

    const now = new Date().toISOString();
    db.update(subjects).set({ name: newName, updatedAt: now }).where(eq(subjects.id, id)).run();
    logChange('subjects', id, 'SAVE', { id, name: newName, updatedAt: now });
}

export function deleteSubject(id: string): void {
    const db = getDb();
    const items = db.select().from(subjectItems).where(eq(subjectItems.subjectId, id)).all();
    for (const item of items) {
        logChange('subject_items', item.id, 'DELETE', { id: item.id });
    }
    db.delete(subjectItems).where(eq(subjectItems.subjectId, id)).run();
    logChange('subjects', id, 'DELETE', { id });
    db.delete(subjects).where(eq(subjects.id, id)).run();
}

export function getItems(subjectId: string): SubjectDocumentItem[] {
    const rows = getDb()
        .select()
        .from(subjectItems)
        .where(eq(subjectItems.subjectId, subjectId))
        .all();
    return rows.map(toSubjectItem);
}

export function deleteItem(id: string): void {
    getDb().delete(subjectItems).where(eq(subjectItems.id, id)).run();
    logChange('subject_items', id, 'DELETE', { id });
}

export function createItem(
    subjectId: string,
    documentTitle: string,
    documentHtmlTree: DocumentHtmlTree | ParagraphReference,
    textContent: string,
    documentIdentity: DocumentIdentity,
    documentPreview?: SubjectDocumentPreview,
): SubjectDocumentItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
        .insert(subjectItems)
        .values({
            id,
            subjectId,
            documentTitle,
            documentHtmlTree: JSON.stringify(documentHtmlTree),
            textContent,
            documentPreview: documentPreview ? JSON.stringify(documentPreview) : null,
            documentIdentity: JSON.stringify(documentIdentity),
            createdAt: now,
            updatedAt: now,
        })
        .run();
    logChange('subject_items', id, 'SAVE', {
        id,
        subjectId,
        documentTitle,
        documentHtmlTree: JSON.stringify(documentHtmlTree),
        textContent,
        documentPreview: documentPreview ? JSON.stringify(documentPreview) : null,
        documentIdentity: JSON.stringify(documentIdentity),
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        subjectId,
        documentTitle,
        documentHtmlTree,
        textContent,
        documentPreview,
        documentIdentity,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}
