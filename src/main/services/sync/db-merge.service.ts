import Database from 'better-sqlite3';
import { getMainSqlite } from '@main/database';
import { setSyncing } from './change-log.service';
import log from 'electron-log';

interface RemoteChangeLog {
    changeId: string;
    tableName: string;
    rowId: string;
    operation: 'SAVE' | 'DELETE';
    newData: string; // JSON of the row
}

/** Tables that we sync — must match the actual SQLite table names. */
const SYNCED_TABLES = new Set([
    'notes',
    'notes_references',
    'notes_bible_references',
    'subjects',
    'subject_items',
    'custom_documents',
    'suggestions',
]);

/**
 * Apply a single remote change log to the local DB.
 * Wrapped in setSyncing to prevent local change logging.
 */
export function applyChangeLog(change: RemoteChangeLog): void {
    if (!SYNCED_TABLES.has(change.tableName)) {
        log.warn(`Skipping sync for unknown table: ${change.tableName}`);
        return;
    }

    const db = getMainSqlite();

    setSyncing(true);
    try {
        db.pragma('foreign_keys = OFF');

        if (change.operation === 'DELETE') {
            const parsed = JSON.parse(change.newData);
            const id = parsed.id;
            if (id) {
                db.prepare(`DELETE FROM ${change.tableName} WHERE id = ?`).run(id);
            }
        } else if (change.operation === 'SAVE') {
            const record = JSON.parse(change.newData);
            const columns = Object.keys(record);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((col) => record[col]);

            // INSERT OR REPLACE — upsert by primary key
            const sql = `INSERT OR REPLACE INTO ${change.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            db.prepare(sql).run(...values);
        }

        db.pragma('foreign_keys = ON');
    } catch (err) {
        log.error(`Failed to apply change ${change.changeId}:`, err);
        db.pragma('foreign_keys = ON');
        throw err;
    } finally {
        setSyncing(false);
    }
}

/**
 * Apply a full database snapshot: for each synced table, upsert all records
 * from the remote DB into the local DB.
 */
export function applySnapshot(snapshotDbPath: string): string[] {
    const localDb = getMainSqlite();
    const remoteDb = new Database(snapshotDbPath, { readonly: true });

    const affectedTables: string[] = [];

    setSyncing(true);
    try {
        localDb.pragma('foreign_keys = OFF');

        for (const tableName of SYNCED_TABLES) {
            try {
                const rows = remoteDb.prepare(`SELECT * FROM ${tableName}`).all();
                if (rows.length === 0) continue;

                const columns = Object.keys(rows[0] as Record<string, unknown>);
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                const stmt = localDb.prepare(sql);

                const insertMany = localDb.transaction((records: Record<string, unknown>[]) => {
                    for (const record of records) {
                        stmt.run(...columns.map((col) => record[col]));
                    }
                });

                insertMany(rows as Record<string, unknown>[]);
                affectedTables.push(tableName);
            } catch (err) {
                log.warn(`Snapshot merge skipped table ${tableName}:`, err);
            }
        }

        localDb.pragma('foreign_keys = ON');
    } finally {
        setSyncing(false);
        remoteDb.close();
    }

    return affectedTables;
}
