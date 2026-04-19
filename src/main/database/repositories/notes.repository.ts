import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import * as bibleService from '@main/services/bible.service';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { notes, notesReferences, notesBibleReferences } from '../schema';
import { bibleVerses } from '../bible-schema';
import { logChange } from '@main/services/sync/change-log.service';
import { parseJsonOrFallback, parseRequiredJson } from '@main/lib/json';
import type {
    DocumentReference,
    NoteItem,
    NoteItemReference,
    NoteItemReferenceBible,
    BibleBook,
    DocumentReferenceSelection,
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
        documentReference: row.documentReference
            ? parseJsonOrFallback<DocumentReference | null>(row.documentReference, null, {
                  scope: 'notes_references',
                  field: 'document_reference',
              })
            : null,
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
        references: parseRequiredJson(row.references, {
            scope: 'notes_bible_references',
            field: 'references',
        }),
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

/** List notes without content (lightweight). */
export function getAllSummary(): { id: string; name: string }[] {
    return getDb().select({ id: notes.id, name: notes.name }).from(notes).all();
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
    const result = getById(id)!;
    logChange('notes', id, 'SAVE', {
        id,
        name,
        defaultName: true,
        created: true,
        createdAt: now,
        updatedAt: now,
    });
    return result;
}

export function deleteNote(id: string): void {
    getDb().delete(notes).where(eq(notes.id, id)).run();
    logChange('notes', id, 'DELETE', { id });
}

export function rename(id: string, newName: string): NoteItem {
    const now = new Date().toISOString();
    getDb()
        .update(notes)
        .set({ name: newName, defaultName: false, updatedAt: now })
        .where(eq(notes.id, id))
        .run();
    const row = getDb().select().from(notes).where(eq(notes.id, id)).get();
    if (row) logChange('notes', id, 'SAVE', row);
    return row ? toNoteItem(row) : getById(id)!;
}

export function updateContent(id: string, content: string): void {
    const now = new Date().toISOString();
    getDb().update(notes).set({ content, updatedAt: now }).where(eq(notes.id, id)).run();
    const row = getDb().select().from(notes).where(eq(notes.id, id)).get();
    if (row) logChange('notes', id, 'SAVE', row);
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

export function createReference(noteId: string, label: string): NoteItemReference {
    const id = randomUUID();
    const now = new Date().toISOString();
    const documentTitle = '';
    getDb()
        .insert(notesReferences)
        .values({
            id,
            noteId,
            label,
            documentTitle,
            documentReference: null,
            textContent: '',
            createdAt: now,
            updatedAt: now,
        })
        .run();
    const refRow = getDb().select().from(notesReferences).where(eq(notesReferences.id, id)).get();
    if (refRow) logChange('notes_references', id, 'SAVE', refRow);
    return refRow ? toNoteRef(refRow) : getReference(id)!;
}

export function getReference(id: string): NoteItemReference | null {
    const row = getDb().select().from(notesReferences).where(eq(notesReferences.id, id)).get();
    return row ? toNoteRef(row) : null;
}

export function syncReferences(noteId: string, refIds: string[]): void {
    const db = getDb();
    // Get existing references for this note
    const existing = db
        .select()
        .from(notesReferences)
        .where(eq(notesReferences.noteId, noteId))
        .all();
    // Delete references whose IDs are not in the provided list
    const keepSet = new Set(refIds);
    const toDelete = existing.filter((row) => !keepSet.has(row.id));
    if (toDelete.length > 0) {
        const idsToDelete = toDelete.map((row) => row.id);
        db.delete(notesReferences).where(inArray(notesReferences.id, idsToDelete)).run();
        for (const row of toDelete) {
            logChange('notes_references', row.id, 'DELETE', { id: row.id });
        }
    }
}

export function updateReference(
    id: string,
    ref: DocumentReferenceSelection,
    documentTitle: string,
): void {
    const now = new Date().toISOString();
    getDb()
        .update(notesReferences)
        .set({
            documentReference: JSON.stringify(ref.documentReference),
            textContent: ref.textContent,
            documentTitle,
            updatedAt: now,
        })
        .where(eq(notesReferences.id, id))
        .run();
    const row = getDb().select().from(notesReferences).where(eq(notesReferences.id, id)).get();
    if (row) logChange('notes_references', id, 'SAVE', row);
}

// --- Bible References ---

export function getBibleReference(id: string): NoteItemReferenceBible | null {
    const row = getDb()
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, id))
        .get();
    return row ? toBibleRef(row) : null;
}

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
    if (row) logChange('notes_bible_references', id, 'SAVE', row);
    return toBibleRef(row!);
}

export function syncBibleReferences(noteId: string, refIds: string[]): void {
    const db = getDb();
    const existing = db
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.noteId, noteId))
        .all();
    // Only delete rows whose IDs are no longer present in the editor
    const keepSet = new Set(refIds);
    const toDelete = existing.filter((row) => !keepSet.has(row.id));
    if (toDelete.length > 0) {
        const idsToDelete = toDelete.map((row) => row.id);
        db.delete(notesBibleReferences).where(inArray(notesBibleReferences.id, idsToDelete)).run();
        for (const row of toDelete) {
            logChange('notes_bible_references', row.id, 'DELETE', { id: row.id });
        }
    }
}

export function addBibleVerse(refId: string, verseId: string): BibleBook | null {
    const sqlite = bibleService.getActiveBibleDb();
    if (!sqlite) return null;
    const bibleDb = drizzle(sqlite, { schema: { bibleVerses } });
    const verse = bibleDb.select().from(bibleVerses).where(eq(bibleVerses.id, verseId)).get();
    if (!verse) return null;

    const bibleBook: BibleBook = {
        id: verse.id,
        bookName: verse.bookName,
        book: verse.book,
        testament: verse.testament,
        chapter: verse.chapter,
        verse: verse.verse,
        content: verse.content,
    };

    const row = getDb()
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, refId))
        .get();
    if (!row) return null;
    const refs = parseRequiredJson<BibleBook[]>(row.references, {
        scope: 'notes_bible_references',
        field: 'references',
    });
    // $addToSet equivalent — only add if not already present
    if (!refs.some((r) => r.id === bibleBook.id)) {
        refs.push(bibleBook);
    }
    const now = new Date().toISOString();
    getDb()
        .update(notesBibleReferences)
        .set({ references: JSON.stringify(refs), updatedAt: now })
        .where(eq(notesBibleReferences.id, refId))
        .run();
    const updatedRow = getDb()
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, refId))
        .get();
    if (updatedRow) logChange('notes_bible_references', refId, 'SAVE', updatedRow);

    return bibleBook;
}

export function deleteReference(id: string): void {
    const db = getDb();

    const noteReference = db.select().from(notesReferences).where(eq(notesReferences.id, id)).get();
    if (noteReference) {
        db.delete(notesReferences).where(eq(notesReferences.id, id)).run();
        logChange('notes_references', id, 'DELETE', { id });
        return;
    }

    const bibleReference = db
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, id))
        .get();
    if (bibleReference) {
        db.delete(notesBibleReferences).where(eq(notesBibleReferences.id, id)).run();
        logChange('notes_bible_references', id, 'DELETE', { id });
    }
}

export function removeBibleVerse(refId: string, verseId: string): void {
    const row = getDb()
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, refId))
        .get();
    if (!row) return;
    const refs = parseRequiredJson<BibleBook[]>(row.references, {
        scope: 'notes_bible_references',
        field: 'references',
    });
    const filtered = refs.filter((r) => r.id !== verseId);
    const now = new Date().toISOString();
    getDb()
        .update(notesBibleReferences)
        .set({ references: JSON.stringify(filtered), updatedAt: now })
        .where(eq(notesBibleReferences.id, refId))
        .run();
    const updatedRow = getDb()
        .select()
        .from(notesBibleReferences)
        .where(eq(notesBibleReferences.id, refId))
        .get();
    if (updatedRow) logChange('notes_bible_references', refId, 'SAVE', updatedRow);
}
