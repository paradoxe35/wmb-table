import { app } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import * as syncSchema from './sync-schema';
import * as bibleSchema from './bible-schema';
import { initializeReferenceDb, closeReferenceDb } from './reference-db';
import * as bibleService from '@main/services/bible.service';
import * as configRepo from './repositories/config.repository';
import { getDatabaseDir } from '@main/lib/app-paths';
import { strNormalize } from '@shared/searchable';

export { getRefDb } from './reference-db';

/** Case/accent folding exposed to SQL, matching `strNormalize` exactly */
export const SQL_NORMALIZE_FUNCTION = 'wmb_normalize';

let mainSqlite: Database.Database | null = null;
let mainDb: BetterSQLite3Database<typeof schema> | null = null;

// Drizzle wrapper over the active Bible DB (from bible.service)
let bibleDb: BetterSQLite3Database<typeof bibleSchema> | null = null;

// Sync database (change tracking, separate from user data)
let syncSqlite: Database.Database | null = null;
let syncDb: BetterSQLite3Database<typeof syncSchema> | null = null;

/**
 * Lets SQL reuse the renderer's normalization, so search matches across case and
 * accents without persisting a second copy of every message.
 */
function registerSqlFunctions(db: Database.Database): void {
    db.function(SQL_NORMALIZE_FUNCTION, { deterministic: true }, (value: unknown) =>
        typeof value === 'string' ? strNormalize(value) : null,
    );
}

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

export function initializeDatabase(): void {
    const dbDir = getDatabaseDir();

    // Main database
    const mainPath = join(dbDir, 'wmb-table.sqlite');
    mainSqlite = new Database(mainPath);
    setPragmas(mainSqlite);
    registerSqlFunctions(mainSqlite);
    mainDb = drizzle(mainSqlite, { schema });

    // Run Drizzle migrations
    const migrationsFolder = getMigrationsFolder();
    if (existsSync(migrationsFolder)) {
        migrate(mainDb, { migrationsFolder });
    }

    // Sync database (change tracking)
    const syncPath = join(dbDir, 'sync.sqlite');
    syncSqlite = new Database(syncPath);
    setPragmas(syncSqlite);
    syncDb = drizzle(syncSqlite, { schema: syncSchema });
    initializeSyncSchema(syncSqlite);

    // Reference database (read-only, bundled)
    initializeReferenceDb();

    // Bible database (read-only, bundled per language)
    const contentLanguage = configRepo.getContentLanguage();
    if (contentLanguage) switchBibleLanguage(contentLanguage);
}

/**
 * Switch the Bible DB to match the given language. Updates the Drizzle wrapper.
 */
export function switchBibleLanguage(langCode: string): void {
    const activeBibleVersionAbbreviation = configRepo.getActiveBibleVersionAbbreviation();
    const activeVersion = bibleService.switchBibleForLanguage(
        langCode,
        activeBibleVersionAbbreviation,
    );
    refreshBibleDrizzle();
    configRepo.setActiveBibleVersionAbbreviation(activeVersion?.abbreviation ?? null);
}

/**
 * Re-sync the Drizzle wrapper after bible.service state changes (e.g., version switch).
 */
export function refreshBibleDrizzle(): void {
    const sqlite = bibleService.peekActiveBibleDb();
    bibleDb = sqlite ? drizzle(sqlite, { schema: bibleSchema }) : null;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
    if (!mainDb) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return mainDb;
}

export function getBibleDb(): BetterSQLite3Database<typeof bibleSchema> {
    const sqlite = bibleService.getActiveBibleDb();
    if (!sqlite) {
        throw new Error(
            'Bible database not initialized. No Bible version available for current language.',
        );
    }

    if (!bibleDb) {
        bibleDb = drizzle(sqlite, { schema: bibleSchema });
    }
    return bibleDb;
}

export function getBibleSqlite(): Database.Database {
    const sqlite = bibleService.getActiveBibleDb();
    if (!sqlite)
        throw new Error(
            'Bible database not initialized. No Bible version available for current language.',
        );
    return sqlite;
}

export function getMainSqlite(): Database.Database {
    if (!mainSqlite) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return mainSqlite;
}

export function getSyncDb(): BetterSQLite3Database<typeof syncSchema> {
    if (!syncDb) throw new Error('Sync database not initialized. Call initializeDatabase() first.');
    return syncDb;
}

export function getSyncSqlite(): Database.Database {
    if (!syncSqlite)
        throw new Error('Sync database not initialized. Call initializeDatabase() first.');
    return syncSqlite;
}

function initializeSyncSchema(db: Database.Database): void {
    db.exec(`
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
}

export function closeDatabase(): void {
    closeReferenceDb();
    bibleService.closeBibleDb();
    bibleDb = null;
    if (syncSqlite) {
        syncSqlite.close();
        syncSqlite = null;
        syncDb = null;
    }
    if (mainSqlite) {
        mainSqlite.close();
        mainSqlite = null;
        mainDb = null;
    }
}

// For testing: allow injecting in-memory databases
export function _setDbForTesting(
    db: BetterSQLite3Database<typeof schema>,
    sqlite?: Database.Database,
): void {
    mainDb = db;
    if (sqlite) {
        mainSqlite = sqlite;
        registerSqlFunctions(sqlite);
    }
}

export function _setBibleDbForTesting(
    db: BetterSQLite3Database<typeof bibleSchema>,
    sqlite: Database.Database,
): void {
    bibleDb = db;
    bibleService._setBibleDbForTesting(sqlite);
}

export function _setSyncDbForTesting(
    db: BetterSQLite3Database<typeof syncSchema>,
    sqlite?: Database.Database,
): void {
    syncDb = db;
    if (sqlite) syncSqlite = sqlite;
}
