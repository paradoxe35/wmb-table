import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { applyChangeLog } from '@main/services/sync/db-merge.service';
import { getAllChangeLogs, setSyncing } from '@main/services/sync/change-log.service';
import * as notesRepo from '@main/database/repositories/notes.repository';
import * as readingPositionsRepo from '@main/database/repositories/reading-positions.repository';

describe('db-merge.service', () => {
    beforeEach(() => {
        createTestDb();
        setSyncing(false);
    });

    it('applyChangeLog SAVE upserts a record into the target table', () => {
        // First create a note normally
        const note = notesRepo.create('Original');

        // Now simulate a remote SAVE change that updates the note name
        applyChangeLog({
            changeId: `notes-${note.id}-SAVE`,
            tableName: 'notes',
            rowId: note.id,
            operation: 'SAVE',
            newData: JSON.stringify({
                id: note.id,
                name: 'Updated by remote',
                content: null,
                default_name: 0,
                created: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }),
        });

        const updated = notesRepo.getById(note.id);
        expect(updated?.name).toBe('Updated by remote');
    });

    it('applyChangeLog DELETE removes a record', () => {
        const note = notesRepo.create('To delete');

        applyChangeLog({
            changeId: `notes-${note.id}-DELETE`,
            tableName: 'notes',
            rowId: note.id,
            operation: 'DELETE',
            newData: JSON.stringify({ id: note.id }),
        });

        expect(notesRepo.getById(note.id)).toBeNull();
    });

    it('applyChangeLog does not trigger local change logging', () => {
        const note = notesRepo.create('Test');

        // Clear existing change logs from the create
        const beforeApply = getAllChangeLogs().length;

        applyChangeLog({
            changeId: `notes-${note.id}-SAVE`,
            tableName: 'notes',
            rowId: note.id,
            operation: 'SAVE',
            newData: JSON.stringify({
                id: note.id,
                name: 'Remote update',
                content: null,
                default_name: 0,
                created: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }),
        });

        // Change log count should not increase from the applyChangeLog call
        const afterApply = getAllChangeLogs().length;
        expect(afterApply).toBe(beforeApply);
    });

    it('applyChangeLog skips unknown tables', () => {
        // Should not throw
        applyChangeLog({
            changeId: 'unknown_table-id1-SAVE',
            tableName: 'unknown_table',
            rowId: 'id1',
            operation: 'SAVE',
            newData: JSON.stringify({ id: 'id1' }),
        });
    });

    it('applyChangeLog SAVE can insert a new record', () => {
        const id = 'remote-note-id';
        const now = new Date().toISOString();

        applyChangeLog({
            changeId: `notes-${id}-SAVE`,
            tableName: 'notes',
            rowId: id,
            operation: 'SAVE',
            newData: JSON.stringify({
                id,
                name: 'Remote note',
                content: null,
                default_name: 1,
                created: 1,
                created_at: now,
                updated_at: now,
            }),
        });

        const note = notesRepo.getById(id);
        expect(note).not.toBeNull();
        expect(note?.name).toBe('Remote note');
    });

    it('applyChangeLog SAVE upserts a reading position', () => {
        readingPositionsRepo.saveReadingPosition('sermon:en:1:abc', 120, 0);

        applyChangeLog({
            changeId: 'reading_positions-sermon:en:1:abc-SAVE',
            tableName: 'reading_positions',
            rowId: 'sermon:en:1:abc',
            operation: 'SAVE',
            newData: JSON.stringify({
                id: 'sermon:en:1:abc',
                scroll_y: 640,
                scroll_x: 0,
                updated_at: new Date().toISOString(),
            }),
        });

        expect(readingPositionsRepo.getReadingPosition('sermon:en:1:abc')).toEqual({
            documentKey: 'sermon:en:1:abc',
            scrollY: 640,
            scrollX: 0,
        });
    });
});
