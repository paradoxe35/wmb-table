import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import * as schema from '@main/database/schema';
import * as bibleSchema from '@main/database/bible-schema';
import { BIBLE_FTS_SETUP_SQL } from '@main/database/bible-schema';
import { _setDbForTesting, _setBibleDbForTesting } from '@main/database';

export function createTestDb() {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: resolve(__dirname, '../../../../drizzle') });
    _setDbForTesting(db, sqlite);
    return { db, sqlite };
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
