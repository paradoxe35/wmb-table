import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import * as bibleSchema from './bible-schema';
import { BIBLE_FTS_SETUP_SQL } from './bible-schema';

let mainSqlite: Database.Database | null = null;
let bibleSqlite: Database.Database | null = null;
let mainDb: BetterSQLite3Database<typeof schema> | null = null;
let bibleDb: BetterSQLite3Database<typeof bibleSchema> | null = null;

function setPragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -20000');
}

function getMigrationsFolder(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'drizzle');
    }
    return join(__dirname, '../../drizzle');
}

function getDatabaseDir(): string {
    return join(app.getPath('userData'), 'databases');
}

export function initializeDatabase(): void {
    const dbDir = getDatabaseDir();
    mkdirSync(dbDir, { recursive: true });

    // Main database
    const mainPath = join(dbDir, 'wmb-table.sqlite');
    mainSqlite = new Database(mainPath);
    setPragmas(mainSqlite);
    mainDb = drizzle(mainSqlite, { schema });

    // Run Drizzle migrations
    const migrationsFolder = getMigrationsFolder();
    if (existsSync(migrationsFolder)) {
        migrate(mainDb, { migrationsFolder });
    }

    // Bible database
    const biblePath = join(dbDir, 'bible.sqlite');
    bibleSqlite = new Database(biblePath);
    setPragmas(bibleSqlite);

    // Create bible tables via raw SQL (Drizzle can't handle FTS5 virtual tables)
    bibleSqlite.exec(`
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

    // FTS5 + triggers (exec handles multiple statements)
    bibleSqlite.exec(BIBLE_FTS_SETUP_SQL);

    bibleDb = drizzle(bibleSqlite, { schema: bibleSchema });
}

export function getDb(): BetterSQLite3Database<typeof schema> {
    if (!mainDb) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return mainDb;
}

export function getBibleDb(): BetterSQLite3Database<typeof bibleSchema> {
    if (!bibleDb)
        throw new Error('Bible database not initialized. Call initializeDatabase() first.');
    return bibleDb;
}

export function getBibleSqlite(): Database.Database {
    if (!bibleSqlite)
        throw new Error('Bible database not initialized. Call initializeDatabase() first.');
    return bibleSqlite;
}

export function getMainSqlite(): Database.Database {
    if (!mainSqlite) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return mainSqlite;
}

export function closeDatabase(): void {
    if (mainSqlite) {
        mainSqlite.close();
        mainSqlite = null;
        mainDb = null;
    }
    if (bibleSqlite) {
        bibleSqlite.close();
        bibleSqlite = null;
        bibleDb = null;
    }
}

// For testing: allow injecting in-memory databases
export function _setDbForTesting(
    db: BetterSQLite3Database<typeof schema>,
    sqlite?: Database.Database,
): void {
    mainDb = db;
    if (sqlite) mainSqlite = sqlite;
}

export function _setBibleDbForTesting(
    db: BetterSQLite3Database<typeof bibleSchema>,
    sqlite: Database.Database,
): void {
    bibleDb = db;
    bibleSqlite = sqlite;
}
