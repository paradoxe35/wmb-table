import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createTestBibleDb } from '../test-helpers';
import * as notesRepo from '@main/database/repositories/notes.repository';

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
        notesRepo.createReference(note.id, 'Doc Title', { tree: [1, 2] }, 'Some text');
        notesRepo.createBibleReference(note.id, 'Gen 1:1');

        notesRepo.deleteNote(note.id);
        expect(notesRepo.getReferences(note.id)).toHaveLength(0);
        expect(notesRepo.getBibleReferences(note.id)).toHaveLength(0);
    });

    it('createReference and getReferences', () => {
        const note = notesRepo.create('Test');
        const ref = notesRepo.createReference(note.id, 'Doc', { tree: [1] }, 'text');
        expect(ref.documentTitle).toBe('Doc');
        expect(ref.documentHtmlTree).toEqual({ tree: [1] });

        const refs = notesRepo.getReferences(note.id);
        expect(refs).toHaveLength(1);
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
});
