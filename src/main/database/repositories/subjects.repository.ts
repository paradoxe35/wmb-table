import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { subjects, subjectItems } from '../schema';
import type {
  SubjectDocument,
  SubjectDocumentItem,
  DocumentHtmlTree,
  BibleBook,
} from '@shared/types';

function toSubjectItem(row: typeof subjectItems.$inferSelect): SubjectDocumentItem {
  return {
    id: row.id,
    subject: row.subjectName,
    documentTitle: row.documentTitle,
    documentHtmlTree: JSON.parse(row.documentHtmlTree),
    textContent: row.textContent,
    bible: row.bible ? JSON.parse(row.bible) : undefined,
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
      active: row.active ?? false,
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

export function deleteSubject(name: string): void {
  const db = getDb();
  // Delete items by subject name
  db.delete(subjectItems).where(eq(subjectItems.subjectName, name)).run();
  db.delete(subjects).where(eq(subjects.name, name)).run();
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
}

export function createItem(
  subjectName: string,
  documentTitle: string,
  documentHtmlTree: DocumentHtmlTree,
  textContent: string,
  bible?: BibleBook,
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
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return {
    id,
    subject: subjectName,
    documentTitle,
    documentHtmlTree,
    textContent,
    bible,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}
