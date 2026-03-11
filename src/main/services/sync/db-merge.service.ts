import Database from 'better-sqlite3';
import { getMainSqlite } from '@main/database';
import { SYNCED_TABLE_NAMES, toSqlColumnNames } from '@main/database/sync-tables';
import { setSyncing } from './change-log.service';
import log from 'electron-log';

interface RemoteChangeLog {
    changeId: string;
    tableName: string;
    rowId: string;
    operation: 'SAVE' | 'DELETE';
    newData: string; // JSON of the row
}

export type AffectedTables = Record<string, string[]>;

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
export function applyChangeLog(change: RemoteChangeLog): AffectedTables {
    if (!SYNCED_TABLE_NAMES.has(change.tableName)) {
        log.warn(`Skipping sync for unknown table: ${change.tableName}`);
        return {};
    }

    const db = getMainSqlite();
    const affectedTables: AffectedTables = {};

    setSyncing(true);
    try {
        db.pragma('foreign_keys = OFF');

        // Wrap in a transaction for atomicity
        const applyInTransaction = db.transaction(() => {
            if (change.operation === 'DELETE') {
                db.prepare(`DELETE FROM "${change.tableName}" WHERE id = ?`).run(change.rowId);
                affectedTables[change.tableName] = [change.rowId];
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
export function applySnapshot(snapshotDbPath: string): AffectedTables {
    const localDb = getMainSqlite();
    const remoteDb = new Database(snapshotDbPath, { readonly: true });
    const affectedTables: AffectedTables = {};

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
                if (rows.length === 0) continue;

                const localCols = getLocalColumns(tableName);
                const columns = Object.keys(rows[0] as Record<string, unknown>).filter(
                    (c) => isValidIdentifier(c) && localCols.has(c),
                );
                if (columns.length === 0) continue;

                const sql = buildUpsertSql(tableName, columns);
                const stmt = localDb.prepare(sql);

                const insertMany = localDb.transaction((records: Record<string, unknown>[]) => {
                    for (const record of records) {
                        stmt.run(...columns.map((col) => record[col]));
                    }
                });

                insertMany(rows as Record<string, unknown>[]);

                const recordIds = (rows as Record<string, unknown>[])
                    .map((r) => String(r.id ?? ''))
                    .filter(Boolean);
                affectedTables[tableName] = recordIds;
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
