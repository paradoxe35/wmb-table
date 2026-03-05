import { join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { app } from 'electron';
import { eq } from 'drizzle-orm';
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
    isSyncRunning = true;
    lastError = null;

    try {
        await applyRemoteChanges();
        await createDbSnapshotIfNeeded();
        await syncChangesToDrive();
        lastSyncTime = new Date().toISOString();
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

async function applyRemoteChanges(): Promise<void> {
    if (!driveService) return;

    const db = getSyncDb();
    const timeOffset = getLastSyncTimeOffset();

    // Check for snapshot first
    const snapshot = await driveService.getLatestSnapshot();
    if (snapshot && snapshot.createdTime > timeOffset) {
        const alreadyProcessed = db
            .select()
            .from(processedChanges)
            .where(eq(processedChanges.fileId, snapshot.id))
            .get();

        if (!alreadyProcessed) {
            const failures = getFailureCount(snapshot.id);
            if (failures < MAX_SNAPSHOT_RETRIES) {
                try {
                    await applyRemoteSnapshot(snapshot);
                    db.insert(processedChanges)
                        .values({ fileId: snapshot.id })
                        .onConflictDoNothing()
                        .run();
                    notifyRenderer();
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
        const alreadyProcessed = db
            .select()
            .from(processedChanges)
            .where(eq(processedChanges.fileId, file.id))
            .get();

        if (alreadyProcessed) continue;

        const failures = getFailureCount(file.id);
        if (failures >= MAX_CHANGE_RETRIES) continue;

        try {
            const content = await driveService.getFileContent(file.id);
            const change = JSON.parse(content.toString('utf-8'));
            applyChangeLog(change);

            db.insert(processedChanges).values({ fileId: file.id }).onConflictDoNothing().run();
        } catch (err) {
            incrementFailure(file.id);
            log.warn(`Failed to apply change file ${file.id}:`, err);
        }
    }

    // Update time offset
    if (remoteFiles.length > 0) {
        const latest = remoteFiles[remoteFiles.length - 1];
        updateSyncTimeOffset(latest.createdTime);
        notifyRenderer();
    }
}

async function applyRemoteSnapshot(snapshot: DriveFile): Promise<void> {
    if (!driveService) return;

    const content = await driveService.getFileContent(snapshot.id);
    const decompressed = gunzipSync(content);

    const tmpPath = join(app.getPath('temp'), `wmb-snapshot-${Date.now()}.sqlite`);
    writeFileSync(tmpPath, decompressed);

    try {
        applySnapshot(tmpPath);
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
            await driveService.uploadChangeLog(change);
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

    // Only snapshot if no pending unsynced changes
    const unsynced = getUnsyncedChanges();
    if (unsynced.length > 0) return;

    try {
        const mainDbPath = getMainSqlite().name;
        const dbContent = readFileSync(mainDbPath);
        const compressed = gzipSync(dbContent);

        await driveService.saveSnapshot(compressed);
        lastSnapshotTime = now;

        // Prune old change logs and snapshots
        const oneWeekAgo = new Date(now - SNAPSHOT_INTERVAL_MS).toISOString();
        deleteOldChangeLogs(oneWeekAgo);
        await driveService.pruneOldChanges(oneWeekAgo);
        await driveService.pruneOldSnapshots(2);

        log.info('Database snapshot created and old changes pruned');
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

function notifyRenderer(): void {
    try {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(PushChannels.newSynchronizedDatas);
        }
    } catch {
        // Window may not exist yet
    }
}
