import { eq, and, lt, inArray, asc } from 'drizzle-orm';
import { getSyncDb } from '@main/database';
import { changeLogs } from '@main/database/sync-schema';
import { toSqlColumnNames } from '@main/database/sync-tables';

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
    // Convert Drizzle JS property names to SQL column names before storing
    const sqlData =
        data && typeof data === 'object' && !Array.isArray(data)
            ? toSqlColumnNames(tableName, data as Record<string, unknown>)
            : data;
    const newData = JSON.stringify(sqlData);

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
    const rows = getSyncDb()
        .select()
        .from(changeLogs)
        .where(eq(changeLogs.synced, false))
        .orderBy(asc(changeLogs.updatedAt), asc(changeLogs.id))
        .all();
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

/**
 * Invalidate (mark as synced) any unsynced local change logs that conflict
 * with remotely-pulled data. This prevents stale local DELETE/SAVE operations
 * from being pushed back to Drive after a pull overwrites them.
 *
 * For example: if Machine B deleted note X locally, then a pull restores X
 * from a remote snapshot, the old local DELETE change log must NOT be pushed —
 * otherwise it would delete note X on all other machines.
 */
export function invalidateStaleChangeLogs(affectedTables: Record<string, string[]>): void {
    const db = getSyncDb();
    for (const [tableName, rowIds] of Object.entries(affectedTables)) {
        if (rowIds.length === 0) continue;

        // Process in batches to avoid SQLite variable limits
        const BATCH = 500;
        for (let i = 0; i < rowIds.length; i += BATCH) {
            const batch = rowIds.slice(i, i + BATCH);
            db.update(changeLogs)
                .set({ synced: true })
                .where(
                    and(
                        eq(changeLogs.tableName, tableName),
                        eq(changeLogs.synced, false),
                        inArray(changeLogs.rowId, batch),
                    ),
                )
                .run();
        }
    }
}
