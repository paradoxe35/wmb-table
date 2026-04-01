import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { getSyncDb } from '@main/database';
import { changeLogs } from '@main/database/sync-schema';
import { applyChangeLog, applySnapshot } from '@main/services/sync/db-merge.service';
import { getAllChangeLogs, setSyncing } from '@main/services/sync/change-log.service';
import * as notesRepo from '@main/database/repositories/notes.repository';
import * as readingPositionsRepo from '@main/database/repositories/reading-positions.repository';

function clearPendingChanges(): void {
    getSyncDb().delete(changeLogs).run();
}

function createSnapshotDb(setup: (sqlite: Database.Database) => void): {
    snapshotPath: string;
    cleanup: () => void;
} {
    const dir = mkdtempSync(join(tmpdir(), 'wmb-sync-snapshot-'));
    const snapshotPath = join(dir, 'snapshot.sqlite');
    const sqlite = new Database(snapshotPath);
    const db = drizzle(sqlite);

    migrate(db, { migrationsFolder: resolve(__dirname, '../../../../../drizzle') });
    setup(sqlite);
    sqlite.close();

    return {
        snapshotPath,
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

describe('db-merge.service', () => {
    beforeEach(() => {
        createTestDb();
        setSyncing(false);
    });

    it('applyChangeLog SAVE upserts a record into the target table', () => {
        // First create a note normally
        const note = notesRepo.create('Original');

        // Now simulate a remote SAVE change that updates the note name
        applyChangeLog(
            {
                changeId: `notes-${note.id}-SAVE`,
                tableName: 'notes',
                rowId: note.id,
                operation: 'SAVE',
                newData: JSON.stringify({
                    id: note.id,
                    name: 'Updated by remote',
                    content: null,
                    default_name: 0,
                    created: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }),
            },
            { remoteTime: new Date().toISOString() },
        );

        const updated = notesRepo.getById(note.id);
        expect(updated?.name).toBe('Updated by remote');
    });

    it('applyChangeLog DELETE removes a record', () => {
        const note = notesRepo.create('To delete');
        clearPendingChanges();

        applyChangeLog(
            {
                changeId: `notes-${note.id}-DELETE`,
                tableName: 'notes',
                rowId: note.id,
                operation: 'DELETE',
                newData: JSON.stringify({ id: note.id }),
            },
            { remoteTime: '2026-02-01T00:00:00.000Z' },
        );

        expect(notesRepo.getById(note.id)).toBeNull();
    });

    it('applyChangeLog does not trigger local change logging', () => {
        const note = notesRepo.create('Test');

        // Clear existing change logs from the create
        const beforeApply = getAllChangeLogs().length;

        applyChangeLog(
            {
                changeId: `notes-${note.id}-SAVE`,
                tableName: 'notes',
                rowId: note.id,
                operation: 'SAVE',
                newData: JSON.stringify({
                    id: note.id,
                    name: 'Remote update',
                    content: null,
                    default_name: 0,
                    created: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }),
            },
            { remoteTime: new Date().toISOString() },
        );

        // Change log count should not increase from the applyChangeLog call
        const afterApply = getAllChangeLogs().length;
        expect(afterApply).toBe(beforeApply);
    });

    it('applyChangeLog skips unknown tables', () => {
        // Should not throw
        applyChangeLog(
            {
                changeId: 'unknown_table-id1-SAVE',
                tableName: 'unknown_table',
                rowId: 'id1',
                operation: 'SAVE',
                newData: JSON.stringify({ id: 'id1' }),
            },
            { remoteTime: new Date().toISOString() },
        );
    });

    it('applyChangeLog SAVE can insert a new record', () => {
        const id = 'remote-note-id';
        const now = new Date().toISOString();

        applyChangeLog(
            {
                changeId: `notes-${id}-SAVE`,
                tableName: 'notes',
                rowId: id,
                operation: 'SAVE',
                newData: JSON.stringify({
                    id,
                    name: 'Remote note',
                    content: null,
                    default_name: 1,
                    created: 1,
                    created_at: now,
                    updated_at: now,
                }),
            },
            { remoteTime: now },
        );

        const note = notesRepo.getById(id);
        expect(note).not.toBeNull();
        expect(note?.name).toBe('Remote note');
    });

    it('applyChangeLog SAVE upserts a reading position', () => {
        readingPositionsRepo.saveReadingPosition('sermon:en:1:abc', 120, 0);

        applyChangeLog(
            {
                changeId: 'reading_positions-sermon:en:1:abc-SAVE',
                tableName: 'reading_positions',
                rowId: 'sermon:en:1:abc',
                operation: 'SAVE',
                newData: JSON.stringify({
                    id: 'sermon:en:1:abc',
                    scroll_y: 640,
                    scroll_x: 0,
                    updated_at: new Date().toISOString(),
                }),
            },
            { remoteTime: new Date().toISOString() },
        );

        expect(readingPositionsRepo.getReadingPosition('sermon:en:1:abc')).toEqual({
            documentKey: 'sermon:en:1:abc',
            scrollY: 640,
            scrollX: 0,
        });
    });

    it('applyChangeLog DELETE manually cascades child rows when foreign keys are disabled', () => {
        const note = notesRepo.create('Parent');
        const reference = notesRepo.createReference(note.id, 'Doc');
        const bibleReference = notesRepo.createBibleReference(note.id, 'Gen 1:1');
        clearPendingChanges();

        const affected = applyChangeLog(
            {
                changeId: `notes-${note.id}-DELETE`,
                tableName: 'notes',
                rowId: note.id,
                operation: 'DELETE',
                newData: JSON.stringify({ id: note.id }),
            },
            { remoteTime: '2026-02-01T00:00:00.000Z' },
        );

        expect(notesRepo.getById(note.id)).toBeNull();
        expect(notesRepo.getReferences(note.id)).toHaveLength(0);
        expect(notesRepo.getBibleReferences(note.id)).toHaveLength(0);
        expect(affected).toEqual(
            expect.objectContaining({
                notes: [note.id],
                notes_references: [reference.id],
                notes_bible_references: [bibleReference.id],
            }),
        );
    });

    it('applyChangeLog keeps newer local unsynced rows instead of overwriting them with stale remote data', () => {
        const note = notesRepo.create('Original');
        clearPendingChanges();
        notesRepo.updateContent(note.id, 'Local newer');

        const remoteUpdatedAt = '2026-01-01T00:00:00.000Z';
        const affected = applyChangeLog(
            {
                changeId: `notes-${note.id}-SAVE`,
                tableName: 'notes',
                rowId: note.id,
                operation: 'SAVE',
                newData: JSON.stringify({
                    id: note.id,
                    name: 'Original',
                    content: 'Remote stale',
                    default_name: 0,
                    created: 1,
                    created_at: '2025-12-31T00:00:00.000Z',
                    updated_at: remoteUpdatedAt,
                }),
            },
            { remoteTime: remoteUpdatedAt },
        );

        expect(affected).toEqual({});
        expect(notesRepo.getById(note.id)?.content).toBe('Local newer');
    });

    it('applySnapshot removes rows missing from the snapshot', () => {
        const keep = notesRepo.create('Keep local');
        const stale = notesRepo.create('Remove local');
        clearPendingChanges();

        const remoteTime = '2026-02-01T00:00:00.000Z';
        const { snapshotPath, cleanup } = createSnapshotDb((sqlite) => {
            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(keep.id, 'Keep remote', null, 1, 1, '2026-01-01T00:00:00.000Z', remoteTime);
        });

        try {
            const affected = applySnapshot(snapshotPath, { remoteTime });

            expect(notesRepo.getById(keep.id)?.name).toBe('Keep remote');
            expect(notesRepo.getById(stale.id)).toBeNull();
            expect(affected.notes.slice().sort()).toEqual([keep.id, stale.id].sort());
        } finally {
            cleanup();
        }
    });

    it('applySnapshot preserves newer local unsynced rows over older snapshot data', () => {
        const note = notesRepo.create('Original');
        clearPendingChanges();
        notesRepo.updateContent(note.id, 'Local newer');

        const remoteTime = '2026-01-01T00:00:00.000Z';
        const { snapshotPath, cleanup } = createSnapshotDb((sqlite) => {
            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    note.id,
                    'Original',
                    'Remote stale',
                    1,
                    1,
                    '2025-12-31T00:00:00.000Z',
                    remoteTime,
                );
        });

        try {
            const affected = applySnapshot(snapshotPath, { remoteTime });

            expect(affected.notes).toBeUndefined();
            expect(notesRepo.getById(note.id)?.content).toBe('Local newer');
        } finally {
            cleanup();
        }
    });
});
