import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import { getMainSqlite } from './index';
import log from 'electron-log';

const DB_EXTENSION = '.db';

function getAssetDbPath(): string {
    return join(process.resourcesPath, 'assets', 'datas', 'db');
}

function getAssetBackupPath(): string {
    return join(process.resourcesPath, 'assets', 'datas', 'backup');
}

function getAppHomePath(): string {
    return join(app.getPath('home'), '.wmb-table');
}

interface NedbDateObject {
    $$date: number;
}

function deserializeNedbDate(value: unknown): string {
    if (value && typeof value === 'object' && '$$date' in (value as Record<string, unknown>)) {
        return new Date((value as NedbDateObject).$$date).toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return new Date().toISOString();
}

function parseNedbFile(filePath: string): Record<string, unknown>[] {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf-8');
    const docs: Record<string, unknown>[] = [];
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('$$')) continue;
        try {
            const parsed = JSON.parse(trimmed, (_key, value) => {
                if (value && typeof value === 'object' && '$$date' in value) {
                    return new Date(value.$$date);
                }
                return value;
            });
            if (parsed && typeof parsed === 'object' && !parsed.$$deleted) {
                docs.push(parsed);
            }
        } catch {
            // Skip malformed lines
        }
    }
    return docs;
}

function hasExistingData(sqlite: import('better-sqlite3').Database, table: string): boolean {
    try {
        const row = sqlite.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
        return row.cnt > 0;
    } catch {
        return false;
    }
}

export function migrateFromNedb(): void {
    const mainSqlite = getMainSqlite();

    // Idempotency: skip if main DB already has data
    if (hasExistingData(mainSqlite, 'configurations')) {
        return;
    }

    const dbPath = getAssetDbPath();
    if (!existsSync(dbPath)) {
        log.info('No legacy NeDB data found, skipping migration');
        return;
    }

    log.info('Starting NeDB → SQLite migration...');

    mainSqlite.exec('BEGIN TRANSACTION');
    try {
        migrateConfigurations(mainSqlite, dbPath);
        migrateHistory(mainSqlite, dbPath);
        migrateSubjects(mainSqlite, dbPath);
        migrateTabs(mainSqlite, dbPath);
        migrateSuggestions(mainSqlite, dbPath);
        migrateSidebarStatus(mainSqlite, dbPath);
        migrateCustomDocuments(mainSqlite, dbPath);
        migrateNotes(mainSqlite, dbPath);
        migrateAudio(mainSqlite, dbPath);
        migrateBackup(mainSqlite);
        migrateAudioDownloads(mainSqlite);

        mainSqlite.exec('COMMIT');
        log.info('NeDB → SQLite migration complete (main DB)');
    } catch (err) {
        mainSqlite.exec('ROLLBACK');
        log.error('NeDB migration failed, rolled back:', err);
        throw err;
    }

    // Bible migration removed — Bible data now comes from bundled per-language files
}

function migrateConfigurations(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const docs = parseNedbFile(join(dbPath, `configurations${DB_EXTENSION}`));
    const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO configurations (id, app_id, initialized, last_check_backup_status) VALUES (?, ?, ?, ?)`,
    );
    for (const doc of docs) {
        stmt.run(
            (doc._id as string) || randomUUID(),
            (doc.app_id as string) || randomUUID(),
            doc.initialized ? 1 : 0,
            deserializeNedbDate(doc.lastCheckBackupStatus),
        );
    }
}

function migrateHistory(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const historyDocs = parseNedbFile(join(dbPath, `history${DB_EXTENSION}`));
    const historyStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO history (id, date, milliseconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const doc of historyDocs) {
        historyStmt.run(
            (doc._id as string) || randomUUID(),
            doc.date as string,
            doc.milliseconds as number,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }

    const itemDocs = parseNedbFile(join(dbPath, `history-item${DB_EXTENSION}`));
    const itemStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO history_items (id, history_id, date, time, document_title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of itemDocs) {
        itemStmt.run(
            (doc._id as string) || randomUUID(),
            doc.historyId as string,
            doc.date as string,
            doc.time as string,
            doc.documentTitle as string,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}

function migrateSubjects(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const subjectDocs = parseNedbFile(join(dbPath, `subjects${DB_EXTENSION}`));
    const subjectStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO subjects (id, name, date, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of subjectDocs) {
        subjectStmt.run(
            (doc._id as string) || randomUUID(),
            doc.name as string,
            (doc.date as string) || new Date().toLocaleDateString(),
            doc.active ? 1 : 0,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }

    const itemDocs = parseNedbFile(join(dbPath, `subject-items${DB_EXTENSION}`));
    const itemStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO subject_items (id, subject_name, document_title, document_html_tree, text_content, bible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of itemDocs) {
        itemStmt.run(
            (doc._id as string) || randomUUID(),
            (doc.subject as string) || (doc.subjectName as string),
            doc.documentTitle as string,
            JSON.stringify(doc.documentHtmlTree),
            doc.textContent as string,
            doc.bible ? JSON.stringify(doc.bible) : null,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}

function migrateTabs(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const docs = parseNedbFile(join(dbPath, `tabs${DB_EXTENSION}`));
    if (docs.length === 0) return;
    const doc = docs[0];
    const datas = doc.datas ? JSON.stringify(doc.datas) : '[]';
    sqlite
        .prepare(`INSERT OR IGNORE INTO tabs (id, datas) VALUES (?, ?)`)
        .run((doc._id as string) || 'tabs-singleton', datas);
}

function migrateSuggestions(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const docs = parseNedbFile(join(dbPath, `suggestions${DB_EXTENSION}`));
    const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO suggestions (id, search_text, found, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const doc of docs) {
        stmt.run(
            (doc._id as string) || randomUUID(),
            doc.searchText as string,
            (doc.found as number) || 0,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}

function migrateSidebarStatus(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const docs = parseNedbFile(join(dbPath, `sidebar-status${DB_EXTENSION}`));
    if (docs.length === 0) return;
    const doc = docs[0];
    sqlite
        .prepare(
            `INSERT OR IGNORE INTO sidebar_status (id, hidden, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        )
        .run(
            (doc._id as string) || 'sidebar-singleton',
            doc.hidden ? 1 : 0,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
}

function migrateCustomDocuments(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const docs = parseNedbFile(join(dbPath, `custom-documents${DB_EXTENSION}`));
    const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO custom_documents (id, document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const doc of docs) {
        stmt.run(
            (doc._id as string) || randomUUID(),
            (doc.documentId as string) || randomUUID(),
            doc.title as string,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}

function migrateNotes(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const noteDocs = parseNedbFile(join(dbPath, `notes${DB_EXTENSION}`));
    const noteStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO notes (id, name, content, default_name, created, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of noteDocs) {
        noteStmt.run(
            (doc._id as string) || randomUUID(),
            doc.name as string,
            (doc.content as string) || null,
            doc.defaultName ? 1 : 0,
            doc.created ? 1 : 0,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }

    const refDocs = parseNedbFile(join(dbPath, `notes-reference${DB_EXTENSION}`));
    const refStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO notes_references (id, note_id, label, document_title, document_html_tree, text_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of refDocs) {
        refStmt.run(
            (doc._id as string) || randomUUID(),
            doc.noteId as string,
            (doc.label as string) || '',
            (doc.documentTitle as string) || '',
            JSON.stringify(doc.documentHtmlTree || {}),
            (doc.textContent as string) || '',
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }

    const bibleDocs = parseNedbFile(join(dbPath, `notes-bible-reference${DB_EXTENSION}`));
    const bibleStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO notes_bible_references (id, note_id, label, references, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const doc of bibleDocs) {
        bibleStmt.run(
            (doc._id as string) || randomUUID(),
            doc.noteId as string,
            (doc.label as string) || '',
            JSON.stringify(doc.references || []),
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}

function migrateAudio(sqlite: import('better-sqlite3').Database, dbPath: string): void {
    const timeDocs = parseNedbFile(join(dbPath, `audio-document-times${DB_EXTENSION}`));
    const timeStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO audio_document_times (id, audio_link, time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const doc of timeDocs) {
        timeStmt.run(
            (doc._id as string) || randomUUID(),
            (doc.audio_link as string) || (doc.audioLink as string),
            (doc.time as number) || 0,
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }

    const lastPlayDocs = parseNedbFile(join(dbPath, `audio-document-last-play${DB_EXTENSION}`));
    if (lastPlayDocs.length > 0) {
        const doc = lastPlayDocs[0];
        sqlite
            .prepare(
                `INSERT OR IGNORE INTO audio_document_last_play (id, reference, doc) VALUES (?, ?, ?)`,
            )
            .run(
                (doc._id as string) || 'last-play-singleton',
                (doc.reference as string) || '',
                doc.doc ? JSON.stringify(doc.doc) : null,
            );
    }
}

function migrateBackup(sqlite: import('better-sqlite3').Database): void {
    const backupPath = getAssetBackupPath();

    const refDocs = parseNedbFile(join(backupPath, `backup-db-references${DB_EXTENSION}`));
    const refStmt = sqlite.prepare(
        `INSERT OR IGNORE INTO backup_db_references (id, filename, lines) VALUES (?, ?, ?)`,
    );
    for (const doc of refDocs) {
        refStmt.run(
            (doc._id as string) || randomUUID(),
            doc.filename as string,
            (doc.lines as string) || '',
        );
    }

    const statusDocs = parseNedbFile(join(backupPath, `backup-status${DB_EXTENSION}`));
    if (statusDocs.length > 0) {
        const doc = statusDocs[0];
        sqlite
            .prepare(
                `INSERT OR IGNORE INTO backup_status (id, email, name, active, access, restored, last_update) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                (doc._id as string) || 'backup-status-singleton',
                (doc.email as string) || '',
                (doc.name as string) || '',
                doc.active ? 1 : 0,
                doc.access ? 1 : 0,
                doc.restored ? 1 : 0,
                deserializeNedbDate(doc.lastUpdate),
            );
    }
}

function migrateAudioDownloads(sqlite: import('better-sqlite3').Database): void {
    const homePath = getAppHomePath();
    const docs = parseNedbFile(join(homePath, `audios-downloads${DB_EXTENSION}`));
    const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO audio_downloads (id, local_file, audio_link, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const doc of docs) {
        stmt.run(
            (doc._id as string) || randomUUID(),
            (doc.local_file as string) || (doc.localFile as string) || null,
            (doc.audio_link as string) || (doc.audioLink as string) || '',
            deserializeNedbDate(doc.createdAt),
            deserializeNedbDate(doc.updatedAt),
        );
    }
}
