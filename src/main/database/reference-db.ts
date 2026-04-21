import { app } from 'electron';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const READONLY_SQLITE_MMAP_SIZE = 64 * 1024 * 1024;
const READONLY_SQLITE_CACHE_SIZE = -4000;

let refSqlite: Database.Database | null = null;

function getRefDbPath(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'database', 'data.sqlite');
    }
    return join(__dirname, '../../resources/database/data.sqlite');
}

export function initializeReferenceDb(): void {
    const dbPath = getRefDbPath();
    refSqlite = new Database(dbPath, { readonly: true, fileMustExist: true });
    refSqlite.pragma(`mmap_size = ${READONLY_SQLITE_MMAP_SIZE}`);
    refSqlite.pragma(`cache_size = ${READONLY_SQLITE_CACHE_SIZE}`);
}

export function getRefDb(): Database.Database {
    if (!refSqlite)
        throw new Error('Reference DB not initialized. Call initializeReferenceDb() first.');
    return refSqlite;
}

export function closeReferenceDb(): void {
    if (refSqlite) {
        refSqlite.close();
        refSqlite = null;
    }
}

export function _setRefDbForTesting(sqlite: Database.Database): void {
    refSqlite = sqlite;
}
