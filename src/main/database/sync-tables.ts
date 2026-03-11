import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { syncedTables } from './schema';

// ---------------------------------------------------------------------------
// Derived from schema.syncedTables — no manual maintenance needed.
// Add a table to syncedTables in schema.ts and everything else follows.
// ---------------------------------------------------------------------------

/** Set of SQL table names that participate in sync. */
export const SYNCED_TABLE_NAMES: ReadonlySet<string> = new Set(
    syncedTables.map((t) => getTableConfig(t).name),
);

/** Map of SQL table name → { jsPropertyName → sqlColumnName }. */
const jsToSqlMaps = new Map<string, Map<string, string>>();

for (const table of syncedTables) {
    const config = getTableConfig(table);
    const map = new Map<string, string>();
    for (const [jsName, col] of Object.entries(table)) {
        if (col && typeof col === 'object' && 'name' in col && typeof col.name === 'string') {
            map.set(jsName, col.name);
        }
    }
    jsToSqlMaps.set(config.name, map);
}

/** Coerce a JS value into a type SQLite can bind (number, string, bigint, Buffer, null). */
function coerceForSqlite(value: unknown): unknown {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Normalize a record for SQLite insertion:
 * - Remap Drizzle JS property names → SQL column names
 * - Coerce values (booleans → 0/1, objects → JSON, undefined → null)
 */
export function toSqlColumnNames(
    tableName: string,
    data: Record<string, unknown>,
): Record<string, unknown> {
    const colMap = jsToSqlMaps.get(tableName);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        const sqlKey = colMap ? (colMap.get(key) ?? key) : key;
        result[sqlKey] = coerceForSqlite(value);
    }
    return result;
}
