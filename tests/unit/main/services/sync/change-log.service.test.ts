import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { getSyncDb } from '@main/database';
import { changeLogs } from '@main/database/sync-schema';
import {
    logChange,
    getUnsyncedChanges,
    markSynced,
    markSyncedIfNotChanged,
    deleteOldChangeLogs,
    getAllChangeLogs,
    setSyncing,
    invalidateStaleChangeLogs,
} from '@main/services/sync/change-log.service';

describe('change-log.service', () => {
    beforeEach(() => {
        createTestDb();
        setSyncing(false);
    });

    it('logChange creates a new change log entry', () => {
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1', name: 'Test' });
        const changes = getAllChangeLogs();
        expect(changes).toHaveLength(1);
        expect(changes[0].tableName).toBe('notes');
        expect(changes[0].rowId).toBe('id-1');
        expect(changes[0].operation).toBe('SAVE');
        expect(changes[0].synced).toBe(false);
        expect(JSON.parse(changes[0].newData)).toEqual({ id: 'id-1', name: 'Test' });
    });

    it('logChange upserts by changeId (same table-rowId-operation)', () => {
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1', name: 'First' });
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1', name: 'Updated' });

        const changes = getAllChangeLogs();
        expect(changes).toHaveLength(1);
        expect(JSON.parse(changes[0].newData).name).toBe('Updated');
    });

    it('different operations create separate entries', () => {
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1', name: 'Test' });
        logChange('notes', 'id-1', 'DELETE', { id: 'id-1' });

        const changes = getAllChangeLogs();
        expect(changes).toHaveLength(2);
    });

    it('getUnsyncedChanges returns only unsynced entries', () => {
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1' });
        logChange('notes', 'id-2', 'SAVE', { id: 'id-2' });

        const all = getAllChangeLogs();
        markSynced(all[0].id);

        const unsynced = getUnsyncedChanges();
        expect(unsynced).toHaveLength(1);
        expect(unsynced[0].rowId).toBe('id-2');
    });

    it('getUnsyncedChanges returns entries ordered by updatedAt then id', () => {
        const syncDb = getSyncDb();
        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-id-2-SAVE',
                tableName: 'notes',
                rowId: 'id-2',
                operation: 'SAVE',
                newData: JSON.stringify({ id: 'id-2' }),
                synced: false,
                createdAt: '2026-01-02T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
            })
            .run();
        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-id-1-SAVE',
                tableName: 'notes',
                rowId: 'id-1',
                operation: 'SAVE',
                newData: JSON.stringify({ id: 'id-1' }),
                synced: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            })
            .run();

        const unsynced = getUnsyncedChanges();
        expect(unsynced.map((change) => change.rowId)).toEqual(['id-1', 'id-2']);
    });

    it('markSyncedIfNotChanged does not mark a change synced if it changed during upload', () => {
        const syncDb = getSyncDb();

        logChange('notes', 'id-1', 'SAVE', {
            id: 'id-1',
            name: 'Before upload',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });

        syncDb
            .update(changeLogs)
            .set({ updatedAt: '2026-01-01T00:00:00.000Z' })
            .where(eq(changeLogs.changeId, 'notes-id-1-SAVE'))
            .run();

        const beforeUpload = getUnsyncedChanges()[0];

        logChange('notes', 'id-1', 'SAVE', {
            id: 'id-1',
            name: 'Edited during upload',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });

        syncDb
            .update(changeLogs)
            .set({ updatedAt: '2026-01-02T00:00:00.000Z' })
            .where(eq(changeLogs.changeId, 'notes-id-1-SAVE'))
            .run();

        markSyncedIfNotChanged(beforeUpload);

        const current = getAllChangeLogs()[0];
        expect(current.synced).toBe(false);
        expect(JSON.parse(current.newData).name).toBe('Edited during upload');
    });

    it('invalidateStaleChangeLogs only marks targeted unsynced rows as synced', () => {
        logChange('notes', 'note-1', 'SAVE', { id: 'note-1' });
        logChange('notes', 'note-2', 'DELETE', { id: 'note-2' });
        logChange('subjects', 'subject-1', 'SAVE', { id: 'subject-1' });

        invalidateStaleChangeLogs({
            notes: ['note-1'],
            subjects: ['subject-1'],
        });

        const byRowId = new Map(getAllChangeLogs().map((change) => [change.rowId, change]));
        expect(byRowId.get('note-1')?.synced).toBe(true);
        expect(byRowId.get('subject-1')?.synced).toBe(true);
        expect(byRowId.get('note-2')?.synced).toBe(false);
    });

    it('deleteOldChangeLogs removes old synced entries', () => {
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1' });
        const all = getAllChangeLogs();
        markSynced(all[0].id);

        // Delete changes older than the far future
        deleteOldChangeLogs('2099-01-01T00:00:00.000Z');
        expect(getAllChangeLogs()).toHaveLength(0);
    });

    it('logChange is a no-op when syncing flag is set', () => {
        setSyncing(true);
        logChange('notes', 'id-1', 'SAVE', { id: 'id-1' });
        expect(getAllChangeLogs()).toHaveLength(0);
        setSyncing(false);
    });
});
