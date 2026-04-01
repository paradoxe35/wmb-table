import Database from 'better-sqlite3';
import { getMainSqlite } from '@main/database';
import { SYNCED_TABLE_NAMES, toSqlColumnNames } from '@main/database/sync-tables';
import { getUnsyncedChanges, setSyncing, type ChangeLogRecord } from './change-log.service';
import log from 'electron-log';

interface RemoteChangeLog {
    changeId: string;
    tableName: string;
    rowId: string;
    operation: 'SAVE' | 'DELETE';
    newData: string; // JSON of the row
}

export type AffectedTables = Record<string, string[]>;

export interface RemoteApplyOptions {
    remoteTime: string;
}

/** Only allow safe SQL identifiers (alphanumeric + underscore). */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isValidIdentifier(name: string): boolean {
    return SAFE_IDENTIFIER.test(name);
}

/** Quote a column name to handle SQL reserved words (e.g. "references"). */
function quoteColumn(name: string): string {
    return `"${name}"`;
}

/** Cache of local table columns to avoid repeated PRAGMA calls. */
const localColumnsCache = new Map<string, Set<string>>();

const CASCADE_RELATIONS: Record<string, { childTable: string; foreignKey: string }[]> = {
    notes: [
        { childTable: 'notes_references', foreignKey: 'note_id' },
        { childTable: 'notes_bible_references', foreignKey: 'note_id' },
    ],
    subjects: [{ childTable: 'subject_items', foreignKey: 'subject_id' }],
    ai_conversations: [{ childTable: 'ai_messages', foreignKey: 'conversation_id' }],
};

/** Get the set of column names for a local table. */
function getLocalColumns(tableName: string): Set<string> {
    let columns = localColumnsCache.get(tableName);
    if (columns) return columns;
    const db = getMainSqlite();
    const rows = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[];
    columns = new Set(rows.map((r) => r.name));
    localColumnsCache.set(tableName, columns);
    return columns;
}

/** Invalidate local columns cache (e.g. after a migration). */
export function clearLocalColumnsCache(): void {
    localColumnsCache.clear();
}

function mergeAffectedTables(target: AffectedTables, source: AffectedTables): void {
    for (const [tableName, rowIds] of Object.entries(source)) {
        if (!target[tableName]) {
            target[tableName] = [];
        }

        for (const rowId of rowIds) {
            if (!target[tableName].includes(rowId)) {
                target[tableName].push(rowId);
            }
        }
    }
}

function getRowKey(tableName: string, rowId: string): string {
    return `${tableName}:${rowId}`;
}

function extractUpdatedAtFromData(raw: string): string | null {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = (parsed as Record<string, unknown>).updated_at;
        return typeof candidate === 'string' ? candidate : null;
    } catch {
        return null;
    }
}

function extractUpdatedAtFromRecord(record: Record<string, unknown>): string | null {
    const candidate = record.updated_at ?? record.updatedAt;
    return typeof candidate === 'string' ? candidate : null;
}

function getLocalChangeMarker(change: ChangeLogRecord): string | null {
    return extractUpdatedAtFromData(change.newData) ?? change.updatedAt ?? change.createdAt;
}

function buildPendingLocalChangeMarkers(): Map<string, string> {
    const markers = new Map<string, string>();

    for (const change of getUnsyncedChanges()) {
        const marker = getLocalChangeMarker(change);
        if (!marker) continue;

        const key = getRowKey(change.tableName, change.rowId);
        const existing = markers.get(key);
        if (!existing || marker > existing) {
            markers.set(key, marker);
        }
    }

    return markers;
}

function hasNewerLocalChange(
    pendingMarkers: Map<string, string>,
    tableName: string,
    rowId: string,
    remoteMarker: string,
): boolean {
    const localMarker = pendingMarkers.get(getRowKey(tableName, rowId));
    return !!localMarker && localMarker > remoteMarker;
}

function deleteRowWithManualCascades(
    db: Database.Database,
    tableName: string,
    rowId: string,
): AffectedTables {
    const affectedTables: AffectedTables = {};

    for (const relation of CASCADE_RELATIONS[tableName] ?? []) {
        const childRows = db
            .prepare(`SELECT id FROM "${relation.childTable}" WHERE "${relation.foreignKey}" = ?`)
            .all(rowId) as { id: string }[];

        if (childRows.length === 0) continue;

        db.prepare(`DELETE FROM "${relation.childTable}" WHERE "${relation.foreignKey}" = ?`).run(
            rowId,
        );
        affectedTables[relation.childTable] = childRows.map((row) => row.id);
    }

    db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(rowId);
    affectedTables[tableName] = [rowId];

    return affectedTables;
}

/**
 * Build an INSERT ... ON CONFLICT(id) DO UPDATE SET statement.
 * Only updates columns present in the incoming data, preserving
 * local values for columns the remote doesn't know about.
 */
function buildUpsertSql(tableName: string, columns: string[]): string {
    const quoted = columns.map(quoteColumn).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const updateSet = columns
        .filter((c) => c !== 'id')
        .map((c) => `${quoteColumn(c)} = excluded.${quoteColumn(c)}`)
        .join(', ');

    if (!updateSet) {
        // Only the id column — just insert, ignore conflicts
        return `INSERT OR IGNORE INTO "${tableName}" (${quoted}) VALUES (${placeholders})`;
    }

    return `INSERT INTO "${tableName}" (${quoted}) VALUES (${placeholders}) ON CONFLICT("id") DO UPDATE SET ${updateSet}`;
}

/**
 * Apply a single remote change log to the local DB inside a transaction.
 * Wrapped in setSyncing to prevent local change logging.
 * Returns affected tables with record IDs.
 */
export function applyChangeLog(
    change: RemoteChangeLog,
    options: RemoteApplyOptions,
): AffectedTables {
    if (!SYNCED_TABLE_NAMES.has(change.tableName)) {
        log.warn(`Skipping sync for unknown table: ${change.tableName}`);
        return {};
    }

    const db = getMainSqlite();
    const affectedTables: AffectedTables = {};
    const pendingMarkers = buildPendingLocalChangeMarkers();
    const remoteMarker =
        change.operation === 'SAVE'
            ? (extractUpdatedAtFromData(change.newData) ?? options.remoteTime)
            : options.remoteTime;

    if (hasNewerLocalChange(pendingMarkers, change.tableName, change.rowId, remoteMarker)) {
        log.info(
            `[Sync] Skipping remote ${change.operation} for ${change.tableName}/${change.rowId}: newer local change pending`,
        );
        return {};
    }

    setSyncing(true);
    try {
        db.pragma('foreign_keys = OFF');

        // Wrap in a transaction for atomicity
        const applyInTransaction = db.transaction(() => {
            if (change.operation === 'DELETE') {
                mergeAffectedTables(
                    affectedTables,
                    deleteRowWithManualCascades(db, change.tableName, change.rowId),
                );
            } else if (change.operation === 'SAVE') {
                const rawRecord = JSON.parse(change.newData);
                // Normalize keys: convert any Drizzle JS names to SQL column names
                const record = toSqlColumnNames(change.tableName, rawRecord);
                const localCols = getLocalColumns(change.tableName);
                // Filter to columns that exist in the local schema
                const columns = Object.keys(record).filter(
                    (c) => isValidIdentifier(c) && localCols.has(c),
                );
                if (columns.length === 0) {
                    throw new Error(`No valid columns in change ${change.changeId}`);
                }
                const values = columns.map((col) => record[col]);
                const sql = buildUpsertSql(change.tableName, columns);
                db.prepare(sql).run(...values);
                affectedTables[change.tableName] = [change.rowId];
            }
        });

        applyInTransaction();
    } finally {
        db.pragma('foreign_keys = ON');
        setSyncing(false);
    }

    return affectedTables;
}

/**
 * Apply a full database snapshot: for each synced table, upsert all records
 * from the remote DB into the local DB.
 * Includes schema compatibility check before merging each table.
 * Returns affected tables with record IDs.
 */
export function applySnapshot(snapshotDbPath: string, options: RemoteApplyOptions): AffectedTables {
    const localDb = getMainSqlite();
    const remoteDb = new Database(snapshotDbPath, { readonly: true });
    const affectedTables: AffectedTables = {};
    const pendingMarkers = buildPendingLocalChangeMarkers();

    setSyncing(true);
    try {
        localDb.pragma('foreign_keys = OFF');

        for (const tableName of SYNCED_TABLE_NAMES) {
            try {
                // Schema compatibility check before merge
                if (!areTableSchemasCompatible(localDb, remoteDb, tableName)) {
                    log.warn(`Schema mismatch for table ${tableName}, skipping`);
                    continue;
                }

                const rows = remoteDb.prepare(`SELECT * FROM "${tableName}"`).all();
                const remoteRows = rows as Record<string, unknown>[];
                const remoteRowIds = new Set<string>();

                const localCols = getLocalColumns(tableName);
                const columns =
                    remoteRows.length === 0
                        ? []
                        : Object.keys(remoteRows[0]).filter(
                              (c) => isValidIdentifier(c) && localCols.has(c),
                          );

                const rowsToUpsert: Record<string, unknown>[] = [];
                const upsertedIds: string[] = [];
                for (const row of remoteRows) {
                    const rowId = String(row.id ?? '');
                    if (!rowId) continue;

                    remoteRowIds.add(rowId);

                    const remoteMarker = extractUpdatedAtFromRecord(row) ?? options.remoteTime;
                    if (hasNewerLocalChange(pendingMarkers, tableName, rowId, remoteMarker)) {
                        continue;
                    }

                    rowsToUpsert.push(row);
                    upsertedIds.push(rowId);
                }

                if (rowsToUpsert.length > 0 && columns.length > 0) {
                    const sql = buildUpsertSql(tableName, columns);
                    const stmt = localDb.prepare(sql);

                    const insertMany = localDb.transaction((records: Record<string, unknown>[]) => {
                        for (const record of records) {
                            stmt.run(...columns.map((col) => record[col]));
                        }
                    });

                    insertMany(rowsToUpsert);
                }

                const localRows = localDb.prepare(`SELECT id FROM "${tableName}"`).all() as {
                    id: string;
                }[];
                const rowsToDelete = localRows
                    .map((row) => String(row.id ?? ''))
                    .filter(Boolean)
                    .filter((rowId) => !remoteRowIds.has(rowId))
                    .filter(
                        (rowId) =>
                            !hasNewerLocalChange(
                                pendingMarkers,
                                tableName,
                                rowId,
                                options.remoteTime,
                            ),
                    );

                if (rowsToDelete.length > 0) {
                    const deleteById = localDb.prepare(`DELETE FROM "${tableName}" WHERE id = ?`);
                    const deleteMany = localDb.transaction((rowIds: string[]) => {
                        for (const rowId of rowIds) {
                            deleteById.run(rowId);
                        }
                    });
                    deleteMany(rowsToDelete);
                }

                const touchedIds = [...new Set([...upsertedIds, ...rowsToDelete])];
                if (touchedIds.length > 0) {
                    affectedTables[tableName] = touchedIds;
                }
            } catch (err) {
                log.warn(`Snapshot merge skipped table ${tableName}:`, err);
            }
        }
    } finally {
        localDb.pragma('foreign_keys = ON');
        setSyncing(false);
        remoteDb.close();
    }

    return affectedTables;
}

/**
 * Verify schema compatibility between local and remote DB for a given table.
 * Checks that the table exists in both DBs and that there is at least one
 * overlapping column.
 */
function areTableSchemasCompatible(
    localDb: Database.Database,
    remoteDb: Database.Database,
    tableName: string,
): boolean {
    try {
        const localColumns = localDb.prepare(`PRAGMA table_info("${tableName}")`).all() as {
            name: string;
            type: string;
        }[];
        const remoteColumns = remoteDb.prepare(`PRAGMA table_info("${tableName}")`).all() as {
            name: string;
            type: string;
        }[];

        if (localColumns.length === 0 || remoteColumns.length === 0) return false;

        const localNames = new Set(localColumns.map((c) => c.name));
        return remoteColumns.some((col) => localNames.has(col.name));
    } catch {
        return false;
    }
}
