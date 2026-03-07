import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Change Logs — tracks local mutations for sync
// ---------------------------------------------------------------------------

export const changeLogs = sqliteTable('change_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    changeId: text('change_id').notNull().unique(),
    tableName: text('table_name').notNull(),
    rowId: text('row_id').notNull(),
    operation: text('operation').notNull(), // 'SAVE' | 'DELETE'
    newData: text('new_data').notNull(), // JSON serialized record
    synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Sync State — last successful sync timestamp
// ---------------------------------------------------------------------------

export const syncState = sqliteTable('sync_state', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    syncTimeOffset: text('sync_time_offset').notNull(), // ISO 8601
});

// ---------------------------------------------------------------------------
// Processed Changes — remote file IDs already applied
// ---------------------------------------------------------------------------

export const processedChanges = sqliteTable('processed_changes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: text('file_id').notNull().unique(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Apply Failures — retry counter for failed remote applies
// ---------------------------------------------------------------------------

export const applyFailures = sqliteTable('apply_failures', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: text('file_id').notNull().unique(),
    count: integer('count').notNull().default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
});
