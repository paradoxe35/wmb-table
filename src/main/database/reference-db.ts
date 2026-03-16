import { app } from 'electron';
import { join } from 'node:path';
import Database from 'better-sqlite3';

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
