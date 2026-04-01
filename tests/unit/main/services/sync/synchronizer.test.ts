import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { getSyncDb } from '@main/database';
import { changeLogs, processedChanges } from '@main/database/sync-schema';
import { getUnsyncedChanges, setSyncing } from '@main/services/sync/change-log.service';
import type { DriveFile } from '@main/services/sync/drive.service';
import type { ChangeLogRecord } from '@main/services/sync/change-log.service';

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/tmp',
        isPackaged: false,
    },
    shell: {
        openExternal: vi.fn(),
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/lib/network', () => ({
    hasInternet: vi.fn(async () => true),
}));

vi.mock('@main/lib/push', () => ({
    pushToRenderer: vi.fn(),
}));

vi.mock('@main/database/repositories/backup.repository', () => ({
    getStatus: vi.fn(() => ({ active: false })),
}));

describe('synchronizer', () => {
    beforeEach(() => {
        createTestDb();
        setSyncing(false);
    });

    it('pushes changes for the same row sequentially in updatedAt order', async () => {
        const syncDb = getSyncDb();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-row-1-SAVE',
                tableName: 'notes',
                rowId: 'row-1',
                operation: 'SAVE',
                newData: JSON.stringify({ id: 'row-1', updated_at: '2026-01-03T00:00:00.000Z' }),
                synced: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-03T00:00:00.000Z',
            })
            .run();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-row-1-DELETE',
                tableName: 'notes',
                rowId: 'row-1',
                operation: 'DELETE',
                newData: JSON.stringify({ id: 'row-1' }),
                synced: false,
                createdAt: '2026-01-02T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
            })
            .run();

        const uploadOrder: string[] = [];
        const drive = {
            deleteChangeLog: vi.fn(async () => [] as DriveFile[]),
            uploadChangeLog: vi.fn(async (change: ChangeLogRecord) => {
                uploadOrder.push(change.changeId);
                return {
                    id: `file-${change.changeId}`,
                    name: `${change.changeId}.json`,
                    isSnapshot: false,
                    createdTime: '2026-01-04T00:00:00.000Z',
                } satisfies DriveFile;
            }),
        };

        const { __testing } = await import('@main/services/sync/synchronizer');
        await __testing.pushChangesToDrive(drive, getUnsyncedChanges());

        expect(uploadOrder).toEqual(['notes-row-1-DELETE', 'notes-row-1-SAVE']);
        expect(
            syncDb
                .select()
                .from(changeLogs)
                .all()
                .every((row) => row.synced),
        ).toBe(true);
        expect(syncDb.select().from(processedChanges).all()).toHaveLength(2);
    });
});
