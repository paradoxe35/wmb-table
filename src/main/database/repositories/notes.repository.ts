import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { notes, notesReferences, notesBibleReferences } from '../schema';
import type {
  NoteItem,
  NoteItemReference,
  NoteItemReferenceBible,
  DocumentHtmlTree,
  BibleBook,
  SubjectRefTree,
} from '@shared/types';

function toNoteItem(row: typeof notes.$inferSelect): NoteItem {
  return {
    id: row.id,
    name: row.name,
    content: row.content ?? undefined,
    defaultName: row.defaultName,
    created: row.created,
    createdAt: new Date(row.createdAt ?? Date.now()),
    updatedAt: new Date(row.updatedAt ?? Date.now()),
  };
}

function toNoteRef(row: typeof notesReferences.$inferSelect): NoteItemReference {
  return {
    id: row.id,
    noteId: row.noteId,
    label: row.label,
    documentTitle: row.documentTitle,
    documentHtmlTree: JSON.parse(row.documentHtmlTree),
    textContent: row.textContent,
    createdAt: new Date(row.createdAt ?? Date.now()),
    updatedAt: new Date(row.updatedAt ?? Date.now()),
  };
}

function toBibleRef(row: typeof notesBibleReferences.$inferSelect): NoteItemReferenceBible {
  return {
    id: row.id,
    noteId: row.noteId,
    label: row.label,
    references: JSON.parse(row.references),
    createdAt: new Date(row.createdAt ?? Date.now()),
    updatedAt: new Date(row.updatedAt ?? Date.now()),
  };
}

export function getAll(): NoteItem[] {
  const rows = getDb().select().from(notes).all();
  return rows.map(toNoteItem);
}

export function getById(id: string): NoteItem | null {
  const row = getDb().select().from(notes).where(eq(notes.id, id)).get();
  return row ? toNoteItem(row) : null;
}

export function create(name: string): NoteItem {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .insert(notes)
    .values({ id, name, defaultName: true, created: true, createdAt: now, updatedAt: now })
    .run();
  return getById(id)!;
}

export function deleteNote(id: string): void {
  getDb().delete(notes).where(eq(notes.id, id)).run();
}

export function rename(id: string, newName: string): NoteItem {
  const now = new Date().toISOString();
  getDb()
    .update(notes)
    .set({ name: newName, defaultName: false, updatedAt: now })
    .where(eq(notes.id, id))
    .run();
  return getById(id)!;
}

export function updateContent(id: string, content: string): void {
  const now = new Date().toISOString();
  getDb().update(notes).set({ content, updatedAt: now }).where(eq(notes.id, id)).run();
}

// --- References ---

export function getReferences(noteId: string): NoteItemReference[] {
  const rows = getDb()
    .select()
    .from(notesReferences)
    .where(eq(notesReferences.noteId, noteId))
    .all();
  return rows.map(toNoteRef);
}

export function createReference(
  noteId: string,
  documentTitle: string,
  documentHtmlTree: DocumentHtmlTree,
  textContent: string,
): NoteItemReference {
  const id = randomUUID();
  const now = new Date().toISOString();
  const label = documentTitle;
  getDb()
    .insert(notesReferences)
    .values({
      id,
      noteId,
      label,
      documentTitle,
      documentHtmlTree: JSON.stringify(documentHtmlTree),
      textContent,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getReference(id)!;
}

export function getReference(id: string): NoteItemReference | null {
  const row = getDb().select().from(notesReferences).where(eq(notesReferences.id, id)).get();
  return row ? toNoteRef(row) : null;
}

export function syncReferences(noteId: string, refs: SubjectRefTree[]): void {
  const db = getDb();
  // Delete existing references for this note
  db.delete(notesReferences).where(eq(notesReferences.noteId, noteId)).run();
  // Re-insert from the provided refs
  for (const ref of refs) {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.insert(notesReferences)
      .values({
        id,
        noteId,
        label: '',
        documentTitle: '',
        documentHtmlTree: JSON.stringify(ref.documentHtmlTree),
        textContent: ref.textContent,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

export function updateReference(id: string, ref: SubjectRefTree): void {
  const now = new Date().toISOString();
  getDb()
    .update(notesReferences)
    .set({
      documentHtmlTree: JSON.stringify(ref.documentHtmlTree),
      textContent: ref.textContent,
      updatedAt: now,
    })
    .where(eq(notesReferences.id, id))
    .run();
}

// --- Bible References ---

export function getBibleReferences(noteId: string): NoteItemReferenceBible[] {
  const rows = getDb()
    .select()
    .from(notesBibleReferences)
    .where(eq(notesBibleReferences.noteId, noteId))
    .all();
  return rows.map(toBibleRef);
}

export function createBibleReference(noteId: string, label: string): NoteItemReferenceBible {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .insert(notesBibleReferences)
    .values({
      id,
      noteId,
      label,
      references: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const row = getDb()
    .select()
    .from(notesBibleReferences)
    .where(eq(notesBibleReferences.id, id))
    .get();
  return toBibleRef(row!);
}

export function syncBibleReferences(noteId: string, refs: BibleBook[] | string[]): void {
  const db = getDb();
  db.delete(notesBibleReferences).where(eq(notesBibleReferences.noteId, noteId)).run();
  if (refs.length > 0) {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.insert(notesBibleReferences)
      .values({
        id,
        noteId,
        label: '',
        references: JSON.stringify(refs),
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

export function addBibleVerse(refId: string, verse: BibleBook): void {
  const row = getDb()
    .select()
    .from(notesBibleReferences)
    .where(eq(notesBibleReferences.id, refId))
    .get();
  if (!row) return;
  const refs: BibleBook[] = JSON.parse(row.references);
  // $addToSet equivalent — only add if not already present
  if (!refs.some((r) => r.id === verse.id)) {
    refs.push(verse);
  }
  const now = new Date().toISOString();
  getDb()
    .update(notesBibleReferences)
    .set({ references: JSON.stringify(refs), updatedAt: now })
    .where(eq(notesBibleReferences.id, refId))
    .run();
}

export function removeBibleVerse(refId: string, verseId: string): void {
  const row = getDb()
    .select()
    .from(notesBibleReferences)
    .where(eq(notesBibleReferences.id, refId))
    .get();
  if (!row) return;
  const refs: BibleBook[] = JSON.parse(row.references);
  const filtered = refs.filter((r) => r.id !== verseId);
  const now = new Date().toISOString();
  getDb()
    .update(notesBibleReferences)
    .set({ references: JSON.stringify(filtered), updatedAt: now })
    .where(eq(notesBibleReferences.id, refId))
    .run();
}
