import { eq, and, lt } from 'drizzle-orm';
import { getSyncDb } from '@main/database';
import { changeLogs } from '@main/database/sync-schema';

export interface ChangeLogRecord {
    id: number;
    changeId: string;
    tableName: string;
    rowId: string;
    operation: 'SAVE' | 'DELETE';
    newData: string;
    synced: boolean;
    createdAt: string | null;
    updatedAt: string | null;
}

/**
 * Module-level flag: when true, logChange() is a no-op.
 * Set during remote change application to prevent infinite sync loops.
 */
let _isSyncing = false;

export function setSyncing(value: boolean): void {
    _isSyncing = value;
}

export function isSyncing(): boolean {
    return _isSyncing;
}

/**
 * Log a local mutation for sync. Upserts by changeId so repeated writes
 * to the same record collapse into one pending change.
 */
export function logChange(
    tableName: string,
    rowId: string,
    operation: 'SAVE' | 'DELETE',
    data: unknown,
): void {
    if (_isSyncing) return;

    const db = getSyncDb();
    const changeId = `${tableName}-${rowId}-${operation}`;
    const now = new Date().toISOString();
    const newData = JSON.stringify(data);

    // Upsert: if changeId exists, update it; otherwise insert
    const existing = db.select().from(changeLogs).where(eq(changeLogs.changeId, changeId)).get();

    if (existing) {
        db.update(changeLogs)
            .set({ newData, synced: false, updatedAt: now })
            .where(eq(changeLogs.id, existing.id))
            .run();
    } else {
        db.insert(changeLogs)
            .values({
                changeId,
                tableName,
                rowId,
                operation,
                newData,
                synced: false,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
}

export function getUnsyncedChanges(): ChangeLogRecord[] {
    const rows = getSyncDb().select().from(changeLogs).where(eq(changeLogs.synced, false)).all();
    return rows as ChangeLogRecord[];
}

export function markSynced(id: number): void {
    getSyncDb()
        .update(changeLogs)
        .set({ synced: true, updatedAt: new Date().toISOString() })
        .where(eq(changeLogs.id, id))
        .run();
}

export function deleteOldChangeLogs(before: string): void {
    getSyncDb()
        .delete(changeLogs)
        .where(and(eq(changeLogs.synced, true), lt(changeLogs.createdAt, before)))
        .run();
}

export function getAllChangeLogs(): ChangeLogRecord[] {
    return getSyncDb().select().from(changeLogs).all() as ChangeLogRecord[];
}
