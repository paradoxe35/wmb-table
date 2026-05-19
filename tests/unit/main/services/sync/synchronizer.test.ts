import Database from 'better-sqlite3';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../database/test-helpers';
import { getDb, getSyncDb } from '@main/database';
import { changeLogs, processedChanges } from '@main/database/sync-schema';
import { getUnsyncedChanges, setSyncing } from '@main/services/sync/change-log.service';
import type { DriveFile } from '@main/services/sync/drive.service';
import type { ChangeLogRecord } from '@main/services/sync/change-log.service';
import { notes } from '@main/database/schema';
import * as notesRepo from '@main/database/repositories/notes.repository';
import { PushChannels } from '@shared/ipc.types';

const mockBackupState = vi.hoisted(() => ({
    status: { active: false } as { active: boolean } | null,
    reset() {
        this.status = { active: false };
    },
}));

const mockAuthState = vi.hoisted(() => ({
    client: null as unknown,
    promise: null as Promise<unknown> | null,
    reset() {
        this.client = null;
        this.promise = null;
    },
}));

const mockDriveState = vi.hoisted(() => ({
    remoteFiles: [] as Array<{
        id: string;
        name: string;
        isSnapshot: boolean;
        createdTime: string;
    }>,
    fileContents: new Map<string, Buffer>(),
    latestSnapshot: null as null | {
        id: string;
        name: string;
        isSnapshot: boolean;
        createdTime: string;
    },
    uploadedChanges: [] as Array<{ changeId: string; rowId: string; operation: string }>,
    failedUploadChangeIds: new Set<string>(),
    deletedChangeIds: [] as string[],
    savedSnapshots: [] as Buffer[],
    prunedBefore: [] as string[],
    reset() {
        this.remoteFiles = [];
        this.fileContents = new Map();
        this.latestSnapshot = null;
        this.uploadedChanges = [];
        this.failedUploadChangeIds = new Set();
        this.deletedChangeIds = [];
        this.savedSnapshots = [];
        this.prunedBefore = [];
    },
}));

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/tmp',
        isPackaged: false,
    },
    shell: {
        openExternal: vi.fn(),
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/lib/network', () => ({
    hasInternet: vi.fn(async () => true),
}));

vi.mock('@main/lib/push', () => ({
    pushToRenderer: vi.fn(),
}));

vi.mock('@main/database/repositories/backup.repository', () => ({
    getStatus: vi.fn(() => mockBackupState.status),
}));

vi.mock('@main/services/sync/google-auth.service', () => ({
    getExistingClient: vi.fn(
        () => mockAuthState.promise ?? Promise.resolve(mockAuthState.client as never),
    ),
    refreshAccessTokenIfNeeded: vi.fn(async () => {}),
    revokeAndDeleteToken: vi.fn(async () => {}),
}));

vi.mock('@main/services/sync/drive.service', () => ({
    DB_SNAPSHOT_PREFIX: 'snapshot_',
    CHANGES_FILE_PREFIX: 'changes_',
    GoogleDriveService: class {
        async getLatestSnapshot() {
            return mockDriveState.latestSnapshot;
        }

        async saveSnapshot(content: NodeJS.ReadableStream) {
            mockDriveState.savedSnapshots.push(await streamToBuffer(content));
            const file = {
                id: `snapshot-${mockDriveState.savedSnapshots.length}`,
                name: `snapshot_${mockDriveState.savedSnapshots.length}.db.gz`,
                isSnapshot: true,
                createdTime: new Date().toISOString(),
            };
            mockDriveState.latestSnapshot = file;
            return file;
        }

        async getChangeFilesAfterTimeOffset(timeOffset: string) {
            return mockDriveState.remoteFiles
                .filter((file) => file.createdTime > timeOffset)
                .sort((a, b) => a.createdTime.localeCompare(b.createdTime));
        }

        async uploadChangeLog(change: ChangeLogRecord) {
            if (mockDriveState.failedUploadChangeIds.has(change.changeId)) {
                throw new Error(`upload failed: ${change.changeId}`);
            }

            mockDriveState.uploadedChanges.push({
                changeId: change.changeId,
                rowId: change.rowId,
                operation: change.operation,
            });

            return {
                id: `upload-${change.changeId}`,
                name: `${change.changeId}.json`,
                isSnapshot: false,
                createdTime: new Date().toISOString(),
            };
        }

        async deleteChangeLog(changeId: string) {
            mockDriveState.deletedChangeIds.push(changeId);
            return [] as DriveFile[];
        }

        async getFileContent(fileId: string) {
            const content = mockDriveState.fileContents.get(fileId);
            if (!content) {
                throw new Error(`file not found: ${fileId}`);
            }
            return content;
        }

        async getFileStream(fileId: string) {
            const content = mockDriveState.fileContents.get(fileId);
            if (!content) {
                throw new Error(`file not found: ${fileId}`);
            }
            return Readable.from(content);
        }

        async pruneOldChanges(before: string) {
            mockDriveState.prunedBefore.push(before);
        }
    },
}));

function clearPendingChanges(): void {
    getSyncDb().delete(changeLogs).run();
}

function createCompressedSnapshot(setup: (sqlite: Database.Database) => void): {
    content: Buffer;
    cleanup: () => void;
} {
    const dir = mkdtempSync(join(tmpdir(), 'wmb-sync-smoke-'));
    const snapshotPath = join(dir, 'snapshot.sqlite');
    const sqlite = new Database(snapshotPath);
    const db = drizzle(sqlite);

    migrate(db, { migrationsFolder: resolve(__dirname, '../../../../../drizzle') });
    setup(sqlite);
    sqlite.close();

    return {
        content: gzipSync(readFileSync(snapshotPath)),
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

async function waitUntil(
    predicate: () => boolean,
    timeoutMs: number = 2000,
    intervalMs: number = 20,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Timed out waiting for condition');
}

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

describe('synchronizer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createTestDb();
        setSyncing(false);
        mockBackupState.reset();
        mockAuthState.reset();
        mockDriveState.reset();
    });

    afterEach(async () => {
        const { stopSynchronizer } = await import('@main/services/sync/synchronizer');
        stopSynchronizer();
    });

    it('pushes changes for the same row sequentially in updatedAt order', async () => {
        const syncDb = getSyncDb();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-row-1-SAVE',
                tableName: 'notes',
                rowId: 'row-1',
                operation: 'SAVE',
                newData: JSON.stringify({ id: 'row-1', updated_at: '2026-01-03T00:00:00.000Z' }),
                synced: false,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-03T00:00:00.000Z',
            })
            .run();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: 'notes-row-1-DELETE',
                tableName: 'notes',
                rowId: 'row-1',
                operation: 'DELETE',
                newData: JSON.stringify({ id: 'row-1' }),
                synced: false,
                createdAt: '2026-01-02T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
            })
            .run();

        const uploadOrder: string[] = [];
        const drive = {
            deleteChangeLog: vi.fn(async () => [] as DriveFile[]),
            uploadChangeLog: vi.fn(async (change: ChangeLogRecord) => {
                uploadOrder.push(change.changeId);
                return {
                    id: `file-${change.changeId}`,
                    name: `${change.changeId}.json`,
                    isSnapshot: false,
                    createdTime: '2026-01-04T00:00:00.000Z',
                } satisfies DriveFile;
            }),
        };

        const { __testing } = await import('@main/services/sync/synchronizer');
        await __testing.pushChangesToDrive(drive, getUnsyncedChanges());

        expect(uploadOrder).toEqual(['notes-row-1-DELETE', 'notes-row-1-SAVE']);
        expect(
            syncDb
                .select()
                .from(changeLogs)
                .all()
                .every((row) => row.synced),
        ).toBe(true);
        expect(syncDb.select().from(processedChanges).all()).toHaveLength(2);
    });

    it('tryStartSynchronizer does not start after backup is disabled while auth restoration is in flight', async () => {
        mockBackupState.status = { active: true };
        const deferred = createDeferred<unknown>();
        mockAuthState.promise = deferred.promise;

        const { tryStartSynchronizer, getSyncStatus } =
            await import('@main/services/sync/synchronizer');
        const startPromise = tryStartSynchronizer();

        mockBackupState.status = { active: false };
        deferred.resolve({} as never);
        await startPromise;

        expect(getSyncStatus().enabled).toBe(false);
    });

    it('tryStartSynchronizer does not start after stopSynchronizer invalidates a pending start', async () => {
        mockBackupState.status = { active: true };
        const deferred = createDeferred<unknown>();
        mockAuthState.promise = deferred.promise;

        const { tryStartSynchronizer, stopSynchronizer, getSyncStatus } =
            await import('@main/services/sync/synchronizer');
        const startPromise = tryStartSynchronizer();

        stopSynchronizer();
        deferred.resolve({} as never);
        await startPromise;

        expect(getSyncStatus().enabled).toBe(false);
    });

    it('runs a smoke sync cycle across snapshot pull, remote change apply, invalidation, and ordered push', async () => {
        const keep = notesRepo.create('Keep local');
        const staleLocal = notesRepo.create('Stale local');
        const remoteDelete = notesRepo.create('Delete remotely');
        const remoteDeleteRef = notesRepo.createReference(remoteDelete.id, 'Doc');
        const remoteDeleteBibleRef = notesRepo.createBibleReference(remoteDelete.id, 'Gen 1:1');
        const localPending = notesRepo.create('Pending local');
        const restored = notesRepo.create('Will be restored');
        const ordered = notesRepo.create('Ordered');
        clearPendingChanges();

        notesRepo.updateContent(localPending.id, 'Local newer');
        notesRepo.deleteNote(restored.id);

        const syncDb = getSyncDb();
        syncDb
            .update(changeLogs)
            .set({
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            })
            .where(eq(changeLogs.changeId, `notes-${restored.id}-DELETE`))
            .run();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: `notes-${ordered.id}-DELETE`,
                tableName: 'notes',
                rowId: ordered.id,
                operation: 'DELETE',
                newData: JSON.stringify({ id: ordered.id }),
                synced: false,
                createdAt: '2026-01-02T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
            })
            .run();

        syncDb
            .insert(changeLogs)
            .values({
                changeId: `notes-${ordered.id}-SAVE`,
                tableName: 'notes',
                rowId: ordered.id,
                operation: 'SAVE',
                newData: JSON.stringify({
                    id: ordered.id,
                    name: 'Ordered local',
                    content: 'Newest ordered content',
                    default_name: 1,
                    created: 1,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-03T00:00:00.000Z',
                }),
                synced: false,
                createdAt: '2026-01-03T00:00:00.000Z',
                updatedAt: '2026-01-03T00:00:00.000Z',
            })
            .run();

        const snapshotTime = '2026-02-01T00:00:00.000Z';
        const { content, cleanup } = createCompressedSnapshot((sqlite) => {
            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(keep.id, 'Keep remote', null, 1, 1, '2026-01-01T00:00:00.000Z', snapshotTime);

            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    remoteDelete.id,
                    'Delete remotely',
                    null,
                    1,
                    1,
                    '2026-01-01T00:00:00.000Z',
                    snapshotTime,
                );

            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    localPending.id,
                    'Pending local',
                    'Remote stale',
                    1,
                    1,
                    '2026-01-01T00:00:00.000Z',
                    '2026-01-15T00:00:00.000Z',
                );

            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    restored.id,
                    'Restored remotely',
                    null,
                    1,
                    1,
                    '2026-01-01T00:00:00.000Z',
                    snapshotTime,
                );

            sqlite
                .prepare(
                    `INSERT INTO notes (
                        id, name, content, default_name, created, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    ordered.id,
                    'Ordered remote',
                    'Old ordered content',
                    1,
                    1,
                    '2026-01-01T00:00:00.000Z',
                    '2026-01-02T12:00:00.000Z',
                );

            sqlite
                .prepare(
                    `INSERT INTO notes_references (
                        id, note_id, label, document_title, document_reference, text_content, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    remoteDeleteRef.id,
                    remoteDelete.id,
                    'Doc',
                    '',
                    null,
                    '',
                    '2026-01-01T00:00:00.000Z',
                    snapshotTime,
                );

            sqlite
                .prepare(
                    `INSERT INTO notes_bible_references (
                        id, note_id, label, "references", created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    remoteDeleteBibleRef.id,
                    remoteDelete.id,
                    'Gen 1:1',
                    JSON.stringify([]),
                    '2026-01-01T00:00:00.000Z',
                    snapshotTime,
                );
        });

        try {
            mockDriveState.remoteFiles = [
                {
                    id: 'snapshot-1',
                    name: 'snapshot_2026-02-01.db.gz',
                    isSnapshot: true,
                    createdTime: snapshotTime,
                },
                {
                    id: 'change-delete-1',
                    name: `changes_notes-${remoteDelete.id}-DELETE.json`,
                    isSnapshot: false,
                    createdTime: '2026-02-02T00:00:00.000Z',
                },
                {
                    id: 'change-save-1',
                    name: `changes_notes-${localPending.id}-SAVE.json`,
                    isSnapshot: false,
                    createdTime: '2026-02-03T00:00:00.000Z',
                },
            ];

            mockDriveState.fileContents.set('snapshot-1', content);
            mockDriveState.fileContents.set(
                'change-delete-1',
                Buffer.from(
                    JSON.stringify({
                        changeId: `notes-${remoteDelete.id}-DELETE`,
                        tableName: 'notes',
                        rowId: remoteDelete.id,
                        operation: 'DELETE',
                        newData: JSON.stringify({ id: remoteDelete.id }),
                    }),
                ),
            );
            mockDriveState.fileContents.set(
                'change-save-1',
                Buffer.from(
                    JSON.stringify({
                        changeId: `notes-${localPending.id}-SAVE`,
                        tableName: 'notes',
                        rowId: localPending.id,
                        operation: 'SAVE',
                        newData: JSON.stringify({
                            id: localPending.id,
                            name: 'Pending local',
                            content: 'Remote stale',
                            default_name: 1,
                            created: 1,
                            created_at: '2026-01-01T00:00:00.000Z',
                            updated_at: '2026-01-15T00:00:00.000Z',
                        }),
                    }),
                ),
            );

            mockDriveState.latestSnapshot = {
                id: 'existing-latest',
                name: 'snapshot_recent.db.gz',
                isSnapshot: true,
                createdTime: new Date().toISOString(),
            };

            const { initializeSynchronizer, getSyncStatus } =
                await import('@main/services/sync/synchronizer');
            initializeSynchronizer({} as never);

            await waitUntil(
                () => mockDriveState.uploadedChanges.length === 3 && !getSyncStatus().syncing,
            );

            const uploadedIds = mockDriveState.uploadedChanges.map((change) => change.changeId);
            expect(uploadedIds).toContain(`notes-${localPending.id}-SAVE`);
            expect(uploadedIds).not.toContain(`notes-${restored.id}-DELETE`);
            expect(uploadedIds.filter((changeId) => changeId.includes(ordered.id))).toEqual([
                `notes-${ordered.id}-DELETE`,
                `notes-${ordered.id}-SAVE`,
            ]);

            expect(notesRepo.getById(keep.id)?.name).toBe('Keep remote');
            expect(notesRepo.getById(staleLocal.id)).toBeNull();
            expect(notesRepo.getById(remoteDelete.id)).toBeNull();
            expect(notesRepo.getReferences(remoteDelete.id)).toHaveLength(0);
            expect(notesRepo.getBibleReferences(remoteDelete.id)).toHaveLength(0);
            expect(notesRepo.getById(restored.id)?.name).toBe('Restored remotely');
            expect(notesRepo.getById(localPending.id)?.content).toBe('Local newer');

            const restoredDelete = syncDb
                .select()
                .from(changeLogs)
                .where(eq(changeLogs.changeId, `notes-${restored.id}-DELETE`))
                .get();
            expect(restoredDelete?.synced).toBe(true);

            expect(syncDb.select().from(processedChanges).all()).toHaveLength(6);

            const { pushToRenderer } = await import('@main/lib/push');
            expect(pushToRenderer).toHaveBeenCalledWith(
                PushChannels.newSynchronizedDatas,
                expect.arrayContaining(['notes']),
            );

            expect(mockDriveState.savedSnapshots).toHaveLength(0);
            expect(
                getDb()
                    .select()
                    .from(notes)
                    .all()
                    .some((row) => row.id === staleLocal.id),
            ).toBe(false);
        } finally {
            cleanup();
        }
    });

    it('runSyncCycle reports remote apply failures and does not push local changes', async () => {
        const note = notesRepo.create('Local change');
        clearPendingChanges();
        notesRepo.updateContent(note.id, 'Pending upload');

        mockDriveState.remoteFiles = [
            {
                id: 'bad-change',
                name: `changes_notes-${note.id}-SAVE.json`,
                isSnapshot: false,
                createdTime: '2026-02-10T00:00:00.000Z',
            },
        ];
        mockDriveState.fileContents.set('bad-change', Buffer.from('{not-valid-json'));
        mockDriveState.latestSnapshot = {
            id: 'existing-latest',
            name: 'snapshot_recent.db.gz',
            isSnapshot: true,
            createdTime: new Date().toISOString(),
        };

        const { GoogleDriveService } = await import('@main/services/sync/drive.service');
        const { __testing, getSyncStatus } = await import('@main/services/sync/synchronizer');
        const { pushToRenderer } = await import('@main/lib/push');

        __testing.resetRuntimeState();
        __testing.setDriveService(new GoogleDriveService({} as never));

        await __testing.runSyncCycle();

        expect(mockDriveState.uploadedChanges).toHaveLength(0);
        expect(getSyncStatus().error).toBeTruthy();
        expect(pushToRenderer).toHaveBeenCalledWith(
            PushChannels.syncFailure,
            expect.objectContaining({
                isAuthError: false,
            }),
        );
    });

    it('runSyncCycle reports local upload failures and leaves failed changes pending', async () => {
        const note = notesRepo.create('Local upload failure');
        clearPendingChanges();
        notesRepo.updateContent(note.id, 'Pending upload');
        mockDriveState.failedUploadChangeIds.add(`notes-${note.id}-SAVE`);
        mockDriveState.latestSnapshot = {
            id: 'existing-latest',
            name: 'snapshot_recent.db.gz',
            isSnapshot: true,
            createdTime: new Date().toISOString(),
        };

        const { GoogleDriveService } = await import('@main/services/sync/drive.service');
        const { __testing, getSyncStatus } = await import('@main/services/sync/synchronizer');
        const { pushToRenderer } = await import('@main/lib/push');

        __testing.resetRuntimeState();
        __testing.setDriveService(new GoogleDriveService({} as never));

        await __testing.runSyncCycle();

        expect(mockDriveState.uploadedChanges).toHaveLength(0);
        expect(getSyncStatus().error).toContain('Failed to upload 1 local sync change');
        expect(getUnsyncedChanges().map((change) => change.changeId)).toContain(
            `notes-${note.id}-SAVE`,
        );
        expect(pushToRenderer).toHaveBeenCalledWith(
            PushChannels.syncFailure,
            expect.objectContaining({
                message: expect.stringContaining('Failed to upload 1 local sync change'),
                isAuthError: false,
            }),
        );
        expect(pushToRenderer).not.toHaveBeenCalledWith(
            PushChannels.newSynchronizedDatas,
            expect.any(Array),
        );
    });

    it('runSyncCycle ignores 404 remote files and still pushes local changes', async () => {
        const note = notesRepo.create('Local change');
        clearPendingChanges();
        notesRepo.updateContent(note.id, 'Pending upload');

        mockDriveState.remoteFiles = [
            {
                id: 'missing-change',
                name: `changes_notes-${note.id}-SAVE.json`,
                isSnapshot: false,
                createdTime: '2026-02-11T00:00:00.000Z',
            },
        ];
        mockDriveState.latestSnapshot = {
            id: 'existing-latest',
            name: 'snapshot_recent.db.gz',
            isSnapshot: true,
            createdTime: new Date().toISOString(),
        };

        const { GoogleDriveService } = await import('@main/services/sync/drive.service');
        const { __testing, getSyncStatus } = await import('@main/services/sync/synchronizer');
        const { pushToRenderer } = await import('@main/lib/push');

        __testing.resetRuntimeState();
        __testing.setDriveService(new GoogleDriveService({} as never));

        await __testing.runSyncCycle();

        expect(mockDriveState.uploadedChanges.map((change) => change.changeId)).toEqual([
            `notes-${note.id}-SAVE`,
        ]);
        expect(getSyncStatus().error).toBeNull();
        expect(
            getSyncDb()
                .select()
                .from(processedChanges)
                .all()
                .map((row) => row.fileId),
        ).toEqual(expect.arrayContaining(['missing-change', `upload-notes-${note.id}-SAVE`]));
        expect(pushToRenderer).toHaveBeenCalledWith(
            PushChannels.newSynchronizedDatas,
            expect.any(Array),
        );
    });

    it('runSyncCycle keeps using the captured drive if stopSynchronizer is called mid-cycle', async () => {
        const noteId = 'remote-stop-race';
        let fileReadStarted = false;
        const deferred = createDeferred<Buffer>();

        const drive = {
            getChangeFilesAfterTimeOffset: vi.fn(async () => [
                {
                    id: 'remote-change',
                    name: `changes_notes-${noteId}-SAVE.json`,
                    isSnapshot: false,
                    createdTime: '2026-02-12T00:00:00.000Z',
                } satisfies DriveFile,
            ]),
            getFileContent: vi.fn(async () => {
                fileReadStarted = true;
                return deferred.promise;
            }),
            getLatestSnapshot: vi.fn(async () => null),
            saveSnapshot: vi.fn(async (_content: NodeJS.ReadableStream) => ({
                id: 'snapshot-new',
                name: 'snapshot_new.db.gz',
                isSnapshot: true,
                createdTime: '2026-02-13T00:00:00.000Z',
            })),
            pruneOldChanges: vi.fn(async () => {}),
            deleteChangeLog: vi.fn(async () => [] as DriveFile[]),
            uploadChangeLog: vi.fn(async () => ({
                id: 'upload-id',
                name: 'upload.json',
                isSnapshot: false,
                createdTime: '2026-02-13T00:00:00.000Z',
            })),
        };

        const { __testing, stopSynchronizer } = await import('@main/services/sync/synchronizer');
        __testing.resetRuntimeState();
        __testing.setDriveService(drive as never);

        const runPromise = __testing.runSyncCycle();
        await waitUntil(() => fileReadStarted);
        stopSynchronizer();

        deferred.resolve(
            Buffer.from(
                JSON.stringify({
                    changeId: `notes-${noteId}-SAVE`,
                    tableName: 'notes',
                    rowId: noteId,
                    operation: 'SAVE',
                    newData: JSON.stringify({
                        id: noteId,
                        name: 'Recovered after stop',
                        content: null,
                        default_name: 1,
                        created: 1,
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-02-12T00:00:00.000Z',
                    }),
                }),
            ),
        );

        await expect(runPromise).resolves.toBeUndefined();
        expect(notesRepo.getById(noteId)?.name).toBe('Recovered after stop');
    });

    it('runSyncCycle applies snapshot files from buffered content when getFileStream is unavailable', async () => {
        const snapshotNoteId = 'snapshot-buffer-fallback';
        const { content, cleanup } = createCompressedSnapshot((sqlite) => {
            sqlite
                .prepare(
                    `
                        INSERT INTO notes (
                            id,
                            name,
                            content,
                            default_name,
                            created,
                            created_at,
                            updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                )
                .run(
                    snapshotNoteId,
                    'Restored from buffer fallback',
                    null,
                    1,
                    1,
                    '2026-01-01T00:00:00.000Z',
                    '2026-02-14T00:00:00.000Z',
                );
        });

        try {
            const drive = {
                getChangeFilesAfterTimeOffset: vi.fn(async () => [
                    {
                        id: 'buffer-snapshot',
                        name: 'snapshot_buffer_fallback.db.gz',
                        isSnapshot: true,
                        createdTime: '2026-02-14T00:00:00.000Z',
                    } satisfies DriveFile,
                ]),
                getFileContent: vi.fn(async () => content),
                getLatestSnapshot: vi.fn(async () => null),
                saveSnapshot: vi.fn(async (_content: NodeJS.ReadableStream) => ({
                    id: 'snapshot-new',
                    name: 'snapshot_new.db.gz',
                    isSnapshot: true,
                    createdTime: '2026-02-15T00:00:00.000Z',
                })),
                pruneOldChanges: vi.fn(async () => {}),
                deleteChangeLog: vi.fn(async () => [] as DriveFile[]),
                uploadChangeLog: vi.fn(async () => ({
                    id: 'upload-id',
                    name: 'upload.json',
                    isSnapshot: false,
                    createdTime: '2026-02-15T00:00:00.000Z',
                })),
            };

            const { __testing } = await import('@main/services/sync/synchronizer');
            __testing.resetRuntimeState();
            __testing.setDriveService(drive as never);

            await expect(__testing.runSyncCycle()).resolves.toBeUndefined();
            expect(notesRepo.getById(snapshotNoteId)?.name).toBe('Restored from buffer fallback');
        } finally {
            cleanup();
        }
    });
});
