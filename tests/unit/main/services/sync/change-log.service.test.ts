import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import {
    logChange,
    getUnsyncedChanges,
    markSynced,
    deleteOldChangeLogs,
    getAllChangeLogs,
    setSyncing,
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
