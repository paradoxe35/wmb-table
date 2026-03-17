import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import log from 'electron-log';
import { getDb } from '../index';
import { subjects, subjectItems } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type {
    SubjectDocument,
    SubjectDocumentItem,
    DocumentHtmlTree,
    ParagraphReference,
    BibleBook,
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
        subject: row.subjectName,
        documentTitle: row.documentTitle,
        documentHtmlTree: safeJsonParse(row.documentHtmlTree, { tree: [] }),
        textContent: row.textContent,
        bible: row.bible ? safeJsonParse<BibleBook | undefined>(row.bible, undefined) : undefined,
        sermonId: row.sermonId,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function getAll(): SubjectDocument[] {
    const db = getDb();
    const rows = db.select().from(subjects).orderBy(desc(subjects.createdAt)).all();
    return rows.map((row) => {
        const items = db
            .select()
            .from(subjectItems)
            .where(eq(subjectItems.subjectName, row.name))
            .all();
        return {
            id: row.id,
            name: row.name,
            date: row.date,
            active: false,
            documents: items.map(toSubjectItem),
            createdAt: new Date(row.createdAt ?? Date.now()),
            updatedAt: new Date(row.updatedAt ?? Date.now()),
        };
    });
}

export function create(name: string): SubjectDocument {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = new Date().toLocaleDateString();
    getDb()
        .insert(subjects)
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
    const subject = db.select().from(subjects).where(eq(subjects.id, id)).get();
    if (!subject) return;

    const now = new Date().toISOString();
    db.update(subjectItems)
        .set({ subjectName: newName, updatedAt: now })
        .where(eq(subjectItems.subjectName, subject.name))
        .run();
    db.update(subjects).set({ name: newName, updatedAt: now }).where(eq(subjects.id, id)).run();
    logChange('subjects', id, 'SAVE', { id, name: newName, updatedAt: now });
}

export function deleteSubject(id: string): void {
    const db = getDb();
    const subject = db.select().from(subjects).where(eq(subjects.id, id)).get();
    if (!subject) return;
    // Log item deletes before removing
    const items = db
        .select()
        .from(subjectItems)
        .where(eq(subjectItems.subjectName, subject.name))
        .all();
    for (const item of items) {
        logChange('subject_items', item.id, 'DELETE', { id: item.id });
    }
    db.delete(subjectItems).where(eq(subjectItems.subjectName, subject.name)).run();
    logChange('subjects', subject.id, 'DELETE', { id: subject.id });
    db.delete(subjects).where(eq(subjects.id, id)).run();
}

export function getItems(subjectName: string): SubjectDocumentItem[] {
    const rows = getDb()
        .select()
        .from(subjectItems)
        .where(eq(subjectItems.subjectName, subjectName))
        .all();
    return rows.map(toSubjectItem);
}

export function deleteItem(id: string): void {
    getDb().delete(subjectItems).where(eq(subjectItems.id, id)).run();
    logChange('subject_items', id, 'DELETE', { id });
}

export function createItem(
    subjectName: string,
    documentTitle: string,
    documentHtmlTree: DocumentHtmlTree | ParagraphReference,
    textContent: string,
    bible?: BibleBook,
    sermonId: string = '',
): SubjectDocumentItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
        .insert(subjectItems)
        .values({
            id,
            subjectName,
            documentTitle,
            documentHtmlTree: JSON.stringify(documentHtmlTree),
            textContent,
            bible: bible ? JSON.stringify(bible) : null,
            sermonId,
            createdAt: now,
            updatedAt: now,
        })
        .run();
    logChange('subject_items', id, 'SAVE', {
        id,
        subjectName,
        documentTitle,
        documentHtmlTree: JSON.stringify(documentHtmlTree),
        textContent,
        bible: bible ? JSON.stringify(bible) : null,
        sermonId,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        subject: subjectName,
        documentTitle,
        documentHtmlTree,
        textContent,
        bible,
        sermonId,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}
