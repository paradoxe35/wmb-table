import { join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { app, net } from 'electron';
import { eq, lt } from 'drizzle-orm';
import type { OAuth2Client } from 'google-auth-library';
import log from 'electron-log';

import { getSyncDb, getMainSqlite } from '@main/database';
import { syncState, processedChanges, applyFailures } from '@main/database/sync-schema';
import { getUnsyncedChanges, markSynced, deleteOldChangeLogs } from './change-log.service';
import { GoogleDriveService, type DriveFile } from './drive.service';
import { applyChangeLog, applySnapshot } from './db-merge.service';
import { getExistingClient } from './google-auth.service';
import { getMainWindow } from '@main/lib/window';
import { PushChannels } from '@shared/ipc.types';

const SYNC_INTERVAL_MS = 10_000;
const MAX_CHANGE_RETRIES = 5;
const MAX_SNAPSHOT_RETRIES = 10;
const SNAPSHOT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncRunning = false;
let driveService: GoogleDriveService | null = null;
let lastError: string | null = null;
let lastSyncTime: string | null = null;
let lastSnapshotTime = 0;

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export function startSynchronizer(authClient: OAuth2Client): void {
    if (syncTimer) return;

    driveService = new GoogleDriveService(authClient);
    syncTimer = setInterval(schedulerWorker, SYNC_INTERVAL_MS);
    log.info('Synchronizer started');

    // Run first sync immediately
    schedulerWorker();
}

export function stopSynchronizer(): void {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
    driveService = null;
    log.info('Synchronizer stopped');
}

export function getSyncStatus(): {
    enabled: boolean;
    syncing: boolean;
    lastSync: string | null;
    error: string | null;
} {
    return {
        enabled: driveService !== null,
        syncing: isSyncRunning,
        lastSync: lastSyncTime,
        error: lastError,
    };
}

/**
 * Auto-start synchronizer if user has saved Google credentials.
 * Safe to call at app startup — no-op if no credentials.
 */
export async function tryStartSynchronizer(): Promise<void> {
    try {
        const client = await getExistingClient();
        if (client) {
            startSynchronizer(client);
        }
    } catch (err) {
        log.warn('Could not auto-start synchronizer:', err);
    }
}

/**
 * Initialize synchronizer after a fresh login.
 */
export function initializeSynchronizer(authClient: OAuth2Client): void {
    stopSynchronizer();
    startSynchronizer(authClient);
}

// -----------------------------------------------------------------------
// Scheduler
// -----------------------------------------------------------------------

async function schedulerWorker(): Promise<void> {
    if (isSyncRunning || !driveService) return;
    if (!net.isOnline()) return;

    isSyncRunning = true;
    lastError = null;

    try {
        const affectedTables = await applyRemoteChanges();
        await createDbSnapshotIfNeeded();
        await syncChangesToDrive();
        lastSyncTime = new Date().toISOString();
        if (affectedTables.length > 0) {
            notifyRenderer(affectedTables);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        log.error('Sync cycle error:', msg);
    } finally {
        isSyncRunning = false;
    }
}

// -----------------------------------------------------------------------
// Pull: apply remote changes
// -----------------------------------------------------------------------

async function applyRemoteChanges(): Promise<string[]> {
    if (!driveService) return [];

    const db = getSyncDb();
    const timeOffset = getLastSyncTimeOffset();
    const affectedTables = new Set<string>();

    // Check for snapshot first
    const snapshot = await driveService.getLatestSnapshot();
    if (snapshot && snapshot.createdTime > timeOffset) {
        const alreadyProcessed = db
            .select()
            .from(processedChanges)
            .where(eq(processedChanges.fileId, snapshot.id))
            .get();

        if (alreadyProcessed) {
            updateSyncTimeOffset(snapshot.createdTime);
        } else {
            const failures = getFailureCount(snapshot.id);
            if (failures < MAX_SNAPSHOT_RETRIES) {
                try {
                    const tables = await applyRemoteSnapshot(snapshot);
                    for (const t of tables) affectedTables.add(t);
                    resetFailureCount(snapshot.id);
                    updateSyncTimeOffset(snapshot.createdTime);
                    saveProcessedChange(snapshot.id);
                } catch (err) {
                    incrementFailure(snapshot.id);
                    log.error('Failed to apply snapshot:', err);
                }
            }
        }
    }

    // Then apply individual change files
    const remoteFiles = await driveService.getChangesAfterTimeOffset(timeOffset);

    for (const file of remoteFiles) {
        if (file.createdTime <= timeOffset) continue;

        const alreadyProcessed = db
            .select()
            .from(processedChanges)
            .where(eq(processedChanges.fileId, file.id))
            .get();

        if (alreadyProcessed) {
            updateSyncTimeOffset(file.createdTime);
            continue;
        }

        const failures = getFailureCount(file.id);
        if (failures >= MAX_CHANGE_RETRIES) continue;

        try {
            const content = await driveService.getFileContent(file.id);
            const change = JSON.parse(content.toString('utf-8'));
            applyChangeLog(change);
            affectedTables.add(change.tableName);

            resetFailureCount(file.id);
            updateSyncTimeOffset(file.createdTime);
            saveProcessedChange(file.id);
        } catch (err) {
            incrementFailure(file.id);
            log.warn(`Failed to apply change file ${file.id}:`, err);
        }
    }

    return [...affectedTables];
}

async function applyRemoteSnapshot(snapshot: DriveFile): Promise<string[]> {
    if (!driveService) return [];

    const content = await driveService.getFileContent(snapshot.id);
    const decompressed = gunzipSync(content);

    const tmpPath = join(app.getPath('temp'), `wmb-snapshot-${Date.now()}.sqlite`);
    writeFileSync(tmpPath, decompressed);

    try {
        return applySnapshot(tmpPath);
    } finally {
        try {
            unlinkSync(tmpPath);
        } catch {
            // ignore cleanup errors
        }
    }
}

// -----------------------------------------------------------------------
// Push: upload local changes
// -----------------------------------------------------------------------

async function syncChangesToDrive(): Promise<void> {
    if (!driveService) return;

    const unsynced = getUnsyncedChanges();
    for (const change of unsynced) {
        try {
            // Delete old version of this change from Drive
            const deletedFiles = await driveService.deleteChangeLog(change.changeId);
            for (const file of deletedFiles) {
                deleteProcessedChange(file.id);
            }

            // Upload new version
            const uploaded = await driveService.uploadChangeLog(change);
            saveProcessedChange(uploaded.id);
            markSynced(change.id);
        } catch (err) {
            log.warn(`Failed to upload change ${change.changeId}:`, err);
            break; // Stop on first failure to maintain order
        }
    }
}

// -----------------------------------------------------------------------
// Snapshots
// -----------------------------------------------------------------------

async function createDbSnapshotIfNeeded(): Promise<void> {
    if (!driveService) return;

    const now = Date.now();
    if (now - lastSnapshotTime < SNAPSHOT_INTERVAL_MS) return;

    // Check the latest remote snapshot age
    const latestSnapshot = await driveService.getLatestSnapshot();
    if (latestSnapshot) {
        const snapshotAge = now - new Date(latestSnapshot.createdTime).getTime();
        if (snapshotAge < SNAPSHOT_INTERVAL_MS) {
            lastSnapshotTime = new Date(latestSnapshot.createdTime).getTime();
            return;
        }
    }

    // Don't snapshot if there are pending remote changes
    const timeOffset = getLastSyncTimeOffset();
    const pendingRemote = await driveService.getChangesAfterTimeOffset(timeOffset);
    if (pendingRemote.length > 0) return;

    try {
        const mainDb = getMainSqlite();

        // Checkpoint WAL to ensure all data is in the main file
        mainDb.pragma('wal_checkpoint(TRUNCATE)');

        const dbContent = readFileSync(mainDb.name);
        const compressed = gzipSync(dbContent);

        const newSnapshot = await driveService.saveSnapshot(compressed);
        lastSnapshotTime = now;

        // Record snapshot in sync state
        updateSyncTimeOffset(newSnapshot.createdTime);
        saveProcessedChange(newSnapshot.id);

        // Cleanup old data
        const pruneTime = new Date(
            new Date(newSnapshot.createdTime).getTime() - 1000,
        ).toISOString();
        deleteOldChangeLogs(pruneTime);
        await driveService.pruneOldChanges(pruneTime);
        await driveService.pruneOldSnapshots(2);
        cleanupOldSyncRecords(pruneTime);

        log.info('Database snapshot created and old data pruned');
    } catch (err) {
        log.warn('Failed to create snapshot:', err);
    }
}

// -----------------------------------------------------------------------
// Sync state helpers
// -----------------------------------------------------------------------

function getLastSyncTimeOffset(): string {
    const db = getSyncDb();
    const row = db.select().from(syncState).get();
    return row?.syncTimeOffset ?? new Date(0).toISOString();
}

function updateSyncTimeOffset(offset: string): void {
    const db = getSyncDb();
    const existing = db.select().from(syncState).get();
    if (existing) {
        db.update(syncState)
            .set({ syncTimeOffset: offset })
            .where(eq(syncState.id, existing.id))
            .run();
    } else {
        db.insert(syncState).values({ syncTimeOffset: offset }).run();
    }
}

function getFailureCount(fileId: string): number {
    const db = getSyncDb();
    const row = db.select().from(applyFailures).where(eq(applyFailures.fileId, fileId)).get();
    return row?.count ?? 0;
}

function incrementFailure(fileId: string): void {
    const db = getSyncDb();
    const existing = db.select().from(applyFailures).where(eq(applyFailures.fileId, fileId)).get();
    if (existing) {
        db.update(applyFailures)
            .set({ count: existing.count + 1 })
            .where(eq(applyFailures.id, existing.id))
            .run();
    } else {
        db.insert(applyFailures).values({ fileId, count: 1 }).run();
    }
}

function notifyRenderer(affectedTables: string[]): void {
    try {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(PushChannels.newSynchronizedDatas, affectedTables);
        }
    } catch {
        // Window may not exist yet
    }
}

// -----------------------------------------------------------------------
// Processed changes & failure helpers
// -----------------------------------------------------------------------

function saveProcessedChange(fileId: string): void {
    getSyncDb().insert(processedChanges).values({ fileId }).onConflictDoNothing().run();
}

function deleteProcessedChange(fileId: string): void {
    getSyncDb().delete(processedChanges).where(eq(processedChanges.fileId, fileId)).run();
}

function resetFailureCount(fileId: string): void {
    getSyncDb().delete(applyFailures).where(eq(applyFailures.fileId, fileId)).run();
}

function cleanupOldSyncRecords(before: string): void {
    const db = getSyncDb();
    db.delete(processedChanges).where(lt(processedChanges.createdAt, before)).run();
    db.delete(applyFailures).where(lt(applyFailures.createdAt, before)).run();
}
