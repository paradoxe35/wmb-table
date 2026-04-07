import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { subjects, subjectItems } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import { parseJsonOrFallback, parseRequiredJson } from '@main/lib/json';
import type {
    DocumentReference,
    DocumentPreview,
    SubjectDocument,
    SubjectDocumentItem,
} from '@shared/types';

const subjectItemSelection = {
    id: subjectItems.id,
    subjectId: subjectItems.subjectId,
    sortOrder: subjectItems.sortOrder,
    documentTitle: subjectItems.documentTitle,
    documentReference: subjectItems.documentReference,
    textContent: subjectItems.textContent,
    documentPreview: subjectItems.documentPreview,
    createdAt: subjectItems.createdAt,
    updatedAt: subjectItems.updatedAt,
} as const;

type SubjectItemRow = {
    id: string;
    subjectId: string;
    sortOrder: number;
    documentTitle: string;
    documentReference: string;
    textContent: string;
    documentPreview: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

function toSubjectItem(row: SubjectItemRow): SubjectDocumentItem {
    return {
        id: row.id,
        subjectId: row.subjectId,
        sortOrder: row.sortOrder,
        documentTitle: row.documentTitle,
        documentReference: parseRequiredJson<DocumentReference>(row.documentReference, {
            scope: 'subject_items',
            field: 'document_reference',
        }),
        textContent: row.textContent,
        documentPreview: row.documentPreview
            ? parseJsonOrFallback<DocumentPreview | undefined>(row.documentPreview, undefined, {
                  scope: 'subject_items',
                  field: 'document_preview',
              })
            : undefined,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

function mapSubjectItems(rows: SubjectItemRow[]): SubjectDocumentItem[] {
    return rows.map(toSubjectItem);
}

function toSubjectDocument(
    row: typeof subjects.$inferSelect,
    documents: SubjectDocumentItem[] = [],
): SubjectDocument {
    return {
        id: row.id,
        name: row.name,
        date: row.date,
        active: false,
        documents,
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
    return getDb()
        .select()
        .from(subjects)
        .orderBy(desc(subjects.createdAt))
        .all()
        .map((row) => toSubjectDocument(row));
}

export function getById(id: string): SubjectDocument | null {
    const db = getDb();
    const row = db.select().from(subjects).where(eq(subjects.id, id)).get();
    if (!row) {
        return null;
    }
    const items = db
        .select(subjectItemSelection)
        .from(subjectItems)
        .where(eq(subjectItems.subjectId, row.id))
        .orderBy(asc(subjectItems.sortOrder), asc(subjectItems.createdAt), asc(subjectItems.id))
        .all();

    return toSubjectDocument(row, mapSubjectItems(items));
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
        ...toSubjectDocument({ id, name, date, active: true, createdAt: now, updatedAt: now }, []),
        active: true,
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
    const row = db.select().from(subjects).where(eq(subjects.id, id)).get();
    if (row) {
        logChange('subjects', id, 'SAVE', row);
    }
}

export function deleteSubject(id: string): void {
    const db = getDb();
    const items = db
        .select({ id: subjectItems.id })
        .from(subjectItems)
        .where(eq(subjectItems.subjectId, id))
        .all();
    for (const item of items) {
        logChange('subject_items', item.id, 'DELETE', { id: item.id });
    }
    db.delete(subjectItems).where(eq(subjectItems.subjectId, id)).run();
    logChange('subjects', id, 'DELETE', { id });
    db.delete(subjects).where(eq(subjects.id, id)).run();
}

export function getItems(subjectId: string): SubjectDocumentItem[] {
    const rows = getDb()
        .select(subjectItemSelection)
        .from(subjectItems)
        .where(eq(subjectItems.subjectId, subjectId))
        .orderBy(asc(subjectItems.sortOrder), asc(subjectItems.createdAt), asc(subjectItems.id))
        .all();
    return mapSubjectItems(rows);
}

export function reorderItems(subjectId: string, itemIds: string[]): void {
    const db = getDb();
    const existingItems = db
        .select(subjectItemSelection)
        .from(subjectItems)
        .where(eq(subjectItems.subjectId, subjectId))
        .all();
    const existingIds = existingItems.map((row) => row.id);

    if (existingIds.length !== itemIds.length) {
        throw new Error('La liste des références est incomplète.');
    }

    const existingIdSet = new Set(existingIds);
    if (itemIds.some((id) => !existingIdSet.has(id))) {
        throw new Error('La liste des références contient des éléments invalides.');
    }

    const now = new Date().toISOString();
    const itemsById = new Map(existingItems.map((row) => [row.id, row] as const));

    db.transaction((tx) => {
        itemIds.forEach((id, index) => {
            tx.update(subjectItems)
                .set({
                    sortOrder: index,
                    updatedAt: now,
                })
                .where(and(eq(subjectItems.id, id), eq(subjectItems.subjectId, subjectId)))
                .run();

            const row = itemsById.get(id);
            if (row) {
                logChange('subject_items', id, 'SAVE', {
                    ...row,
                    sortOrder: index,
                    updatedAt: now,
                });
            }
        });
    });
}

export function deleteItem(id: string): void {
    getDb().delete(subjectItems).where(eq(subjectItems.id, id)).run();
    logChange('subject_items', id, 'DELETE', { id });
}

export function createItem(
    subjectId: string,
    documentTitle: string,
    documentReference: DocumentReference,
    textContent: string,
    documentPreview?: DocumentPreview,
): SubjectDocumentItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    const sortOrder =
        (getDb()
            .select({
                value: sql<number>`coalesce(max(${subjectItems.sortOrder}), -1)`,
            })
            .from(subjectItems)
            .where(eq(subjectItems.subjectId, subjectId))
            .get()?.value ?? -1) + 1;

    getDb()
        .insert(subjectItems)
        .values({
            id,
            subjectId,
            sortOrder,
            documentTitle,
            documentReference: JSON.stringify(documentReference),
            textContent,
            documentPreview: documentPreview ? JSON.stringify(documentPreview) : null,
            createdAt: now,
            updatedAt: now,
        })
        .run();

    logChange('subject_items', id, 'SAVE', {
        id,
        subjectId,
        sortOrder,
        documentTitle,
        documentReference: JSON.stringify(documentReference),
        textContent,
        documentPreview: documentPreview ? JSON.stringify(documentPreview) : null,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        subjectId,
        sortOrder,
        documentTitle,
        documentReference,
        textContent,
        documentPreview,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}
