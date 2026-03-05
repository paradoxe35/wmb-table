import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import * as schema from '@main/database/schema';
import * as syncSchema from '@main/database/sync-schema';
import * as bibleSchema from '@main/database/bible-schema';
import { BIBLE_FTS_SETUP_SQL } from '@main/database/bible-schema';
import { _setDbForTesting, _setBibleDbForTesting, _setSyncDbForTesting } from '@main/database';

export function createTestDb() {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: resolve(__dirname, '../../../../drizzle') });
    _setDbForTesting(db, sqlite);

    // Initialize sync database for change tracking
    const syncSqlite = new Database(':memory:');
    syncSqlite.pragma('journal_mode = WAL');
    syncSqlite.exec(`
        CREATE TABLE IF NOT EXISTS change_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            change_id TEXT NOT NULL UNIQUE,
            table_name TEXT NOT NULL,
            row_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            new_data TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_time_offset TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS processed_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS apply_failures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL UNIQUE,
            count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
    const syncDb = drizzle(syncSqlite, { schema: syncSchema });
    _setSyncDbForTesting(syncDb, syncSqlite);

    return { db, sqlite, syncDb, syncSqlite };
}

export function createTestBibleDb() {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      id TEXT PRIMARY KEY NOT NULL,
      book_name TEXT NOT NULL,
      book TEXT NOT NULL,
      testament TEXT NOT NULL,
      chapter TEXT NOT NULL,
      verse TEXT NOT NULL,
      content TEXT NOT NULL
    );
  `);
    sqlite.exec(BIBLE_FTS_SETUP_SQL);
    const db = drizzle(sqlite, { schema: bibleSchema });
    _setBibleDbForTesting(db, sqlite);
    return { db, sqlite };
}
