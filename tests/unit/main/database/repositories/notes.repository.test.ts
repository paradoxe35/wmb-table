import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTestBibleDb } from '../test-helpers';
import * as notesRepo from '@main/database/repositories/notes.repository';
import { getDb } from '@main/database';
import { notesBibleReferences } from '@main/database/schema';
import { eq } from 'drizzle-orm';

describe('notes.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('creates a note with auto-name', () => {
        const note = notesRepo.create('Note 1');
        expect(note.name).toBe('Note 1');
        expect(note.defaultName).toBe(true);
        expect(note.created).toBe(true);
    });

    it('getAll returns all notes', () => {
        notesRepo.create('A');
        notesRepo.create('B');
        expect(notesRepo.getAll()).toHaveLength(2);
    });

    it('getById returns note or null', () => {
        const note = notesRepo.create('Test');
        expect(notesRepo.getById(note.id)?.name).toBe('Test');
        expect(notesRepo.getById('nonexistent')).toBeNull();
    });

    it('rename updates name and defaultName', () => {
        const note = notesRepo.create('Default');
        const renamed = notesRepo.rename(note.id, 'Custom Name');
        expect(renamed.name).toBe('Custom Name');
        expect(renamed.defaultName).toBe(false);
    });

    it('updateContent sets content', () => {
        const note = notesRepo.create('Test');
        notesRepo.updateContent(note.id, 'Hello world');
        expect(notesRepo.getById(note.id)?.content).toBe('Hello world');
    });

    it('delete cascades to references', () => {
        const note = notesRepo.create('Test');
        notesRepo.createReference(note.id, 'Doc Title');
        notesRepo.createBibleReference(note.id, 'Gen 1:1');

        notesRepo.deleteNote(note.id);
        expect(notesRepo.getReferences(note.id)).toHaveLength(0);
        expect(notesRepo.getBibleReferences(note.id)).toHaveLength(0);
    });

    it('createReference and getReferences', () => {
        const note = notesRepo.create('Test');
        const ref = notesRepo.createReference(note.id, 'Doc');
        expect(ref.label).toBe('Doc');
        expect(ref.documentReference).toBeNull();

        const refs = notesRepo.getReferences(note.id);
        expect(refs).toHaveLength(1);
    });

    it('syncReferences removes orphaned refs', () => {
        const note = notesRepo.create('Test');
        const ref1 = notesRepo.createReference(note.id, 'Keep');
        notesRepo.createReference(note.id, 'Remove');

        notesRepo.syncReferences(note.id, [ref1.id]);
        const refs = notesRepo.getReferences(note.id);
        expect(refs).toHaveLength(1);
        expect(refs[0].id).toBe(ref1.id);
    });

    it('syncReferences with empty list removes all', () => {
        const note = notesRepo.create('Test');
        notesRepo.createReference(note.id, 'A');
        notesRepo.createReference(note.id, 'B');
        notesRepo.createReference(note.id, 'C');

        notesRepo.syncReferences(note.id, []);
        expect(notesRepo.getReferences(note.id)).toHaveLength(0);
    });

    it('syncBibleReferences removes orphaned refs', () => {
        const note = notesRepo.create('Test');
        const ref1 = notesRepo.createBibleReference(note.id, 'Gen 1:1');
        notesRepo.createBibleReference(note.id, 'Ex 2:3');

        notesRepo.syncBibleReferences(note.id, [ref1.id]);
        const refs = notesRepo.getBibleReferences(note.id);
        expect(refs).toHaveLength(1);
        expect(refs[0].id).toBe(ref1.id);
    });

    it('addBibleVerse and removeBibleVerse', () => {
        const { sqlite: bibleSqlite } = createTestBibleDb();
        // Insert a test verse into the Bible DB
        bibleSqlite.exec(`
            INSERT INTO bible_verses (id, book_name, book, testament, chapter, verse, content)
            VALUES ('v1', 'Genesis', 'gen', 'OT', '1', '1', 'In the beginning...')
        `);

        const note = notesRepo.create('Test');
        const bibleRef = notesRepo.createBibleReference(note.id, 'Bible Ref');

        notesRepo.addBibleVerse(bibleRef.id, 'v1');

        let refs = notesRepo.getBibleReferences(note.id);
        expect(refs[0].references).toHaveLength(1);

        // Adding same verse again should not duplicate
        notesRepo.addBibleVerse(bibleRef.id, 'v1');
        refs = notesRepo.getBibleReferences(note.id);
        expect(refs[0].references).toHaveLength(1);

        notesRepo.removeBibleVerse(bibleRef.id, 'v1');
        refs = notesRepo.getBibleReferences(note.id);
        expect(refs[0].references).toHaveLength(0);
    });

    it('throws when required bible references JSON is corrupted', () => {
        const note = notesRepo.create('Test');
        const bibleRef = notesRepo.createBibleReference(note.id, 'Bible Ref');

        getDb()
            .update(notesBibleReferences)
            .set({ references: '{invalid json' })
            .where(eq(notesBibleReferences.id, bibleRef.id))
            .run();

        expect(() => notesRepo.getBibleReference(bibleRef.id)).toThrow(
            'Invalid JSON stored in notes_bible_references.references',
        );
    });
});
