import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { getAllChangeLogs, setSyncing } from '@main/services/sync/change-log.service';
import * as notesRepo from '@main/database/repositories/notes.repository';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import * as readingPositionsRepo from '@main/database/repositories/reading-positions.repository';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';

describe('repository change tracking', () => {
    beforeEach(() => {
        createTestDb();
        setSyncing(false);
    });

    describe('notes', () => {
        it('create logs a SAVE change', () => {
            notesRepo.create('Test Note');
            const changes = getAllChangeLogs();
            expect(changes.length).toBeGreaterThanOrEqual(1);
            const noteChange = changes.find(
                (c) => c.tableName === 'notes' && c.operation === 'SAVE',
            );
            expect(noteChange).toBeDefined();
        });

        it('deleteNote logs a DELETE change', () => {
            const note = notesRepo.create('To delete');
            notesRepo.deleteNote(note.id);
            const changes = getAllChangeLogs();
            const deleteChange = changes.find(
                (c) => c.tableName === 'notes' && c.operation === 'DELETE' && c.rowId === note.id,
            );
            expect(deleteChange).toBeDefined();
        });

        it('rename logs a SAVE change', () => {
            const note = notesRepo.create('Original');
            notesRepo.rename(note.id, 'Renamed');
            const after = getAllChangeLogs();
            // Should have more entries (or same due to upsert of same changeId)
            const renameChange = after.find(
                (c) => c.tableName === 'notes' && c.rowId === note.id && c.operation === 'SAVE',
            );
            expect(renameChange).toBeDefined();
            expect(JSON.parse(renameChange!.newData).name).toBe('Renamed');
        });

        it('updateContent logs a SAVE change', () => {
            const note = notesRepo.create('Test');
            notesRepo.updateContent(note.id, 'New content');
            const changes = getAllChangeLogs();
            const contentChange = changes.find(
                (c) => c.tableName === 'notes' && c.rowId === note.id,
            );
            expect(contentChange).toBeDefined();
        });

        it('createReference logs a SAVE change for notes_references', () => {
            const note = notesRepo.create('Test');
            notesRepo.createReference(note.id, 'Doc');
            const changes = getAllChangeLogs();
            const refChange = changes.find((c) => c.tableName === 'notes_references');
            expect(refChange).toBeDefined();
            expect(refChange?.operation).toBe('SAVE');
        });

        it('createBibleReference logs a SAVE change', () => {
            const note = notesRepo.create('Test');
            notesRepo.createBibleReference(note.id, 'Gen 1:1');
            const changes = getAllChangeLogs();
            const bibleChange = changes.find((c) => c.tableName === 'notes_bible_references');
            expect(bibleChange).toBeDefined();
        });
    });

    describe('subjects', () => {
        it('create logs a SAVE change', () => {
            subjectsRepo.create('Test Subject');
            const changes = getAllChangeLogs();
            const subjectChange = changes.find(
                (c) => c.tableName === 'subjects' && c.operation === 'SAVE',
            );
            expect(subjectChange).toBeDefined();
        });

        it('deleteSubject logs DELETE changes for subject and items', () => {
            subjectsRepo.create('Test Subject');
            subjectsRepo.createItem('Test Subject', 'Doc', { tree: [1] }, 'text');
            subjectsRepo.deleteSubject('Test Subject');
            const changes = getAllChangeLogs();
            const subjectDelete = changes.find(
                (c) => c.tableName === 'subjects' && c.operation === 'DELETE',
            );
            const itemDelete = changes.find(
                (c) => c.tableName === 'subject_items' && c.operation === 'DELETE',
            );
            expect(subjectDelete).toBeDefined();
            expect(itemDelete).toBeDefined();
        });

        it('createItem logs a SAVE change', () => {
            subjectsRepo.create('Test');
            subjectsRepo.createItem('Test', 'Doc', { tree: [1] }, 'text');
            const changes = getAllChangeLogs();
            const itemChange = changes.find(
                (c) => c.tableName === 'subject_items' && c.operation === 'SAVE',
            );
            expect(itemChange).toBeDefined();
        });

        it('deleteItem logs a DELETE change', () => {
            subjectsRepo.create('Test');
            const item = subjectsRepo.createItem('Test', 'Doc', { tree: [1] }, 'text');
            subjectsRepo.deleteItem(item.id);
            const changes = getAllChangeLogs();
            const deleteChange = changes.find(
                (c) =>
                    c.tableName === 'subject_items' &&
                    c.operation === 'DELETE' &&
                    c.rowId === item.id,
            );
            expect(deleteChange).toBeDefined();
        });
    });

    describe('custom documents', () => {
        it('createCustomDocument logs a SAVE change', () => {
            customDocsRepo.createCustomDocument('Test Doc', 'content');
            const changes = getAllChangeLogs();
            const docChange = changes.find(
                (c) => c.tableName === 'custom_documents' && c.operation === 'SAVE',
            );
            expect(docChange).toBeDefined();
        });

        it('deleteCustomDocument logs a DELETE change', () => {
            const doc = customDocsRepo.createCustomDocument('Test', 'content');
            customDocsRepo.deleteCustomDocument(doc.id);
            const changes = getAllChangeLogs();
            const deleteChange = changes.find(
                (c) =>
                    c.tableName === 'custom_documents' &&
                    c.operation === 'DELETE' &&
                    c.rowId === doc.id,
            );
            expect(deleteChange).toBeDefined();
        });
    });

    describe('suggestions', () => {
        it('addSuggestion logs a SAVE change', () => {
            suggestionsRepo.addSuggestion('test query', 5, 'en');
            const changes = getAllChangeLogs();
            const suggestionChange = changes.find(
                (c) => c.tableName === 'suggestions' && c.operation === 'SAVE',
            );
            expect(suggestionChange).toBeDefined();
        });
    });

    describe('reading positions', () => {
        it('saveReadingPosition logs a SAVE change', () => {
            readingPositionsRepo.saveReadingPosition('sermon:en:1:abc', 320, 0);
            const changes = getAllChangeLogs();
            const readingPositionChange = changes.find(
                (c) =>
                    c.tableName === 'reading_positions' &&
                    c.operation === 'SAVE' &&
                    c.rowId === 'sermon:en:1:abc',
            );
            expect(readingPositionChange).toBeDefined();
        });
    });
});
