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

    // Atomic upsert: insert or update on changeId conflict
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
        .onConflictDoUpdate({
            target: changeLogs.changeId,
            set: { newData, synced: false, updatedAt: now },
        })
        .run();
}

export function getUnsyncedChanges(): ChangeLogRecord[] {
    const rows = getSyncDb().select().from(changeLogs).where(eq(changeLogs.synced, false)).all();
    return rows as ChangeLogRecord[];
}

/**
 * Mark a change as synced only if it was NOT modified during the upload.
 * Prevents marking a change as synced when the user made another edit
 * while the upload was in progress.
 */
export function markSyncedIfNotChanged(change: ChangeLogRecord): void {
    const db = getSyncDb();
    const current = db.select().from(changeLogs).where(eq(changeLogs.id, change.id)).get();

    if (!current) return;

    // If the changeId still matches AND it was updated after we read it,
    // the user made another edit during upload — skip marking as synced.
    if (
        current.changeId === change.changeId &&
        current.updatedAt &&
        change.updatedAt &&
        current.updatedAt > change.updatedAt
    ) {
        return;
    }

    db.update(changeLogs).set({ synced: true }).where(eq(changeLogs.id, change.id)).run();
}

export function markSynced(id: number): void {
    getSyncDb().update(changeLogs).set({ synced: true }).where(eq(changeLogs.id, id)).run();
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
