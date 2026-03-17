import { join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { app } from 'electron';
import { eq, lt } from 'drizzle-orm';
import type { OAuth2Client } from 'google-auth-library';
import log from 'electron-log';

import { getSyncDb, getMainSqlite } from '@main/database';
import { changeLogs, syncState, processedChanges, applyFailures } from '@main/database/sync-schema';
import {
    getUnsyncedChanges,
    markSyncedIfNotChanged,
    deleteOldChangeLogs,
    invalidateStaleChangeLogs,
} from './change-log.service';
import {
    GoogleDriveService,
    DB_SNAPSHOT_PREFIX,
    CHANGES_FILE_PREFIX,
    type DriveFile,
} from './drive.service';
import { applyChangeLog, applySnapshot, type AffectedTables } from './db-merge.service';
import { getExistingClient } from './google-auth.service';
import * as backupRepo from '@main/database/repositories/backup.repository';
import { hasInternet } from '@main/lib/network';
import { pushToRenderer } from '@main/lib/push';
import { PushChannels } from '@shared/ipc.types';

const SYNC_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_AUTH_FAILURES = 4;
const MAX_CHANGE_RETRIES = 5;
const MAX_SNAPSHOT_RETRIES = 10;
const SNAPSHOT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_TIME_OFFSET = '2000-01-01T00:00:00Z';

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncRunning = false;
let driveService: GoogleDriveService | null = null;
let lastError: string | null = null;
let lastSyncTime: string | null = null;
let lastSnapshotTime = 0;
let consecutiveAuthFailures = 0;

// Affected tables tracked per sync cycle (table → record IDs)
let affectedTables: AffectedTables = {};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Clear all sync tracking data (change logs, sync state, processed changes, failures).
 * Called during logout to ensure a clean slate.
 */
export function clearSyncData(): void {
    const db = getSyncDb();
    db.delete(changeLogs).run();
    db.delete(syncState).run();
    db.delete(processedChanges).run();
    db.delete(applyFailures).run();
    log.info('Sync data cleared');
}

export function startSynchronizer(authClient: OAuth2Client): void {
    if (syncTimer) return;

    driveService = new GoogleDriveService(authClient);
    consecutiveAuthFailures = 0;
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
    consecutiveAuthFailures = 0;
    log.info('Synchronizer stopped');
}

/**
 * Trigger an immediate sync cycle.
 * No-op if sync is already running or synchronizer is not started.
 */
export function syncNow(): void {
    if (!driveService || isSyncRunning) return;
    schedulerWorker();
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
 * Auto-start synchronizer if user has an active backup status AND saved credentials.
 * Safe to call at app startup — no-op if backup is disabled or no credentials.
 */
export async function tryStartSynchronizer(): Promise<void> {
    try {
        const status = backupRepo.getStatus();
        if (!status?.active) return;

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
// Affected tables helpers
// -----------------------------------------------------------------------

function resetAffectedTables(): void {
    affectedTables = {};
}

function mergeAffectedTables(tables: AffectedTables): void {
    for (const [table, ids] of Object.entries(tables)) {
        if (!affectedTables[table]) {
            affectedTables[table] = [];
        }
        for (const id of ids) {
            if (!affectedTables[table].includes(id)) {
                affectedTables[table].push(id);
            }
        }
    }
}

// -----------------------------------------------------------------------
// Scheduler
// -----------------------------------------------------------------------

async function schedulerWorker(): Promise<void> {
    if (isSyncRunning || !driveService) return;
    if (!(await hasInternet())) return;

    isSyncRunning = true;
    resetAffectedTables();

    // Apply remote changes and create snapshots — collect last failure
    let failure: Error | null = null;

    try {
        await applyRemoteChanges();
        // After pull: invalidate any local unsynced change logs that conflict
        // with the pulled data. This prevents stale local DELETEs from being
        // pushed back and erasing records that were just restored by the pull.
        if (Object.keys(affectedTables).length > 0) {
            invalidateStaleChangeLogs(affectedTables);
        }
    } catch (err) {
        failure = err instanceof Error ? err : new Error(String(err));
    }

    // Snapshot creation runs even if pull had errors
    try {
        await createDbSnapshotIfNeeded();
    } catch (err) {
        failure = err instanceof Error ? err : new Error(String(err));
    }

    // Emit success/failure before push
    if (failure) {
        lastError = failure.message;
        log.error('Sync cycle error:', failure.message);

        const isAuthError = isGoogleAuthError(failure);
        if (isAuthError) {
            consecutiveAuthFailures++;
        }

        pushToRenderer(PushChannels.syncFailure, {
            message: failure.message,
            isAuthError,
            consecutiveFailures: consecutiveAuthFailures,
        });

        // After too many consecutive auth failures, stop and let frontend handle re-auth
        if (isAuthError && consecutiveAuthFailures >= MAX_CONSECUTIVE_AUTH_FAILURES) {
            log.error('Too many consecutive auth failures — stopping synchronizer');
            stopSynchronizer();
        }
    } else {
        lastError = null;
        consecutiveAuthFailures = 0;
        lastSyncTime = new Date().toISOString();
        pushToRenderer(PushChannels.newSynchronizedDatas, Object.keys(affectedTables));
    }

    // Push only if pull succeeded — prevents pushing stale/partial data
    // that could overwrite valid data on Drive
    if (!failure) {
        await syncChangesToDrive();
    }

    isSyncRunning = false;
}

// -----------------------------------------------------------------------
// Pull: apply remote changes
// -----------------------------------------------------------------------

/**
 * Processes ALL remote files (snapshots + changes) in chronological order.
 * Snapshots and changes are sorted together by createdTime and applied in sequence.
 */
async function applyRemoteChanges(): Promise<void> {
    if (!driveService) return;

    const timeOffset = getLastSyncTimeOffset();
    const files = await driveService.getChangeFilesAfterTimeOffset(timeOffset);

    if (files.length === 0) return;

    // Filter to actionable files: correct prefix, after offset, not already processed
    const applicable = files.filter(
        (f) => canBeApplied(f) && f.createdTime > timeOffset && !isAlreadyProcessed(f.id),
    );

    // Advance offset past already-processed files without re-downloading them
    for (const file of files) {
        if (canBeApplied(file) && file.createdTime > timeOffset && isAlreadyProcessed(file.id)) {
            updateSyncTimeOffset(file.createdTime);
        }
    }

    if (applicable.length === 0) return;
    log.info(`[Sync] Applying ${applicable.length} remote file(s)`);
    let processed = 0;

    for (const file of applicable) {
        let error: Error | null = null;

        try {
            if (file.isSnapshot) {
                log.info(`[Sync] Applying snapshot: ${file.name}`);
                const tables = await applyRemoteSnapshotFile(file);
                mergeAffectedTables(tables);
            } else {
                const tables = await applyRemoteChangeLogFile(file);
                mergeAffectedTables(tables);
            }
        } catch (err) {
            error = err instanceof Error ? err : new Error(String(err));
        }

        // Check if we can ignore this failure
        if (!canIgnoreRemoteApplyFailure(file, error)) {
            throw error!;
        }

        // Success or permanently skipped — reset failure, update state
        saveFailureCount(file.id, 0);
        updateSyncTimeOffset(file.createdTime);
        saveProcessedChange(file.id);
        processed++;

        if (processed % 10 === 0 || processed === applicable.length) {
            log.info(`[Sync] Processed ${processed}/${applicable.length} remote file(s)`);
        }
    }
}

/**
 * Check if a remote file is a sync file we can process.
 * Filters out non-sync files from appDataFolder.
 */
function canBeApplied(file: DriveFile): boolean {
    return file.name.startsWith(DB_SNAPSHOT_PREFIX) || file.name.startsWith(CHANGES_FILE_PREFIX);
}

/**
 * Determine whether a remote apply failure can be ignored:
 * - No error → true (proceed normally)
 * - Error but too many retries → true (give up on this file, skip it)
 * - Error within retry limit → false (stop processing, will throw)
 */
function canIgnoreRemoteApplyFailure(file: DriveFile, error: Error | null): boolean {
    const maxFailures = file.isSnapshot ? MAX_SNAPSHOT_RETRIES : MAX_CHANGE_RETRIES;

    if (error === null) {
        return true;
    }

    // File was deleted from Drive (e.g., pruned by another machine's snapshot cycle)
    // — safe to skip since the data is already in the snapshot
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('404') || msg.includes('not found')) {
        log.warn(`Remote file no longer exists (skipped): ${file.name}`);
        return true;
    }

    const failureCount = getFailureCount(file.id);
    if (failureCount > maxFailures) {
        log.error(`Failed to apply remote file (ignored, too many failures): ${file.name}`, error);
        return true;
    }

    log.error(`Failed to apply remote file: ${file.name}`, error);
    saveFailureCount(file.id, failureCount + 1);
    return false;
}

async function applyRemoteSnapshotFile(file: DriveFile): Promise<AffectedTables> {
    const content = await driveService!.getFileContent(file.id);
    const decompressed = gunzipSync(content);

    const tmpPath = join(app.getPath('temp'), `wmb-snapshot-${Date.now()}.sqlite`);
    writeFileSync(tmpPath, decompressed);

    try {
        const tables = applySnapshot(tmpPath);
        log.debug(`Snapshot applied successfully: ${file.name}`);
        return tables;
    } finally {
        try {
            unlinkSync(tmpPath);
        } catch {
            // ignore cleanup errors
        }
    }
}

async function applyRemoteChangeLogFile(file: DriveFile): Promise<AffectedTables> {
    const content = await driveService!.getFileContent(file.id);
    const change = JSON.parse(content.toString('utf-8'));
    const tables = applyChangeLog(change);
    log.debug(`Change log applied successfully: ${file.name}`);
    return tables;
}

// -----------------------------------------------------------------------
// Push: upload local changes
// -----------------------------------------------------------------------

/**
 * Upload local unsynced changes to Drive.
 * Runs concurrently for better performance.
 * Uses markSyncedIfNotChanged to avoid marking a change as synced
 * if the user modified it during the upload.
 */
async function syncChangesToDrive(): Promise<void> {
    if (!driveService) return;

    const unsynced = getUnsyncedChanges();
    if (unsynced.length === 0) return;
    log.info(`[Sync] Pushing ${unsynced.length} local change(s) to Drive`);

    const drive = driveService;

    const CONCURRENCY = 20;
    for (let i = 0; i < unsynced.length; i += CONCURRENCY) {
        const batch = unsynced.slice(i, i + CONCURRENCY);
        await Promise.all(
            batch.map(async (change) => {
                // Delete old version from Drive — isolated error handling
                // (delete error doesn't prevent upload)
                try {
                    const deletedFiles = await drive.deleteChangeLog(change.changeId);
                    if (deletedFiles.length > 0) {
                        for (const file of deletedFiles) {
                            deleteProcessedChange(file.id);
                        }
                    }
                } catch (err) {
                    log.warn(`Failed to delete old change ${change.changeId}:`, err);
                }

                // Upload new version
                try {
                    const uploaded = await drive.uploadChangeLog(change);
                    saveProcessedChange(uploaded.id);
                    markSyncedIfNotChanged(change);
                } catch (err) {
                    log.warn(`Failed to upload change ${change.changeId}:`, err);
                }
            }),
        );
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
    const pendingRemote = await driveService.getChangeFilesAfterTimeOffset(timeOffset);
    if (pendingRemote.length > 0) return;

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

    // Prune everything older than 1 second before the snapshot
    const pruneTime = new Date(new Date(newSnapshot.createdTime).getTime() - 1000).toISOString();

    try {
        await driveService.pruneOldChanges(pruneTime);
    } catch (err) {
        log.warn('Failed to prune old changes, retrying...', err);
        // Retry once after a short delay
        await new Promise((r) => setTimeout(r, 5000));
        try {
            await driveService.pruneOldChanges(pruneTime);
        } catch {
            // Give up on pruning this cycle
        }
    }

    // Cleanup local sync records
    deleteOldChangeLogs(pruneTime);
    cleanupOldSyncRecords(pruneTime);

    log.info('Database snapshot created and old data pruned');
}

// -----------------------------------------------------------------------
// Sync state helpers
// -----------------------------------------------------------------------

function getLastSyncTimeOffset(): string {
    const db = getSyncDb();
    const row = db.select().from(syncState).get();
    return row?.syncTimeOffset ?? DEFAULT_TIME_OFFSET;
}

/**
 * Update the sync time offset.
 * Guards against zero/invalid times being stored.
 */
function updateSyncTimeOffset(offset: string): void {
    // Guard against invalid/zero times
    const safeOffset = !offset || offset < DEFAULT_TIME_OFFSET ? DEFAULT_TIME_OFFSET : offset;

    const db = getSyncDb();
    // Single-row table: try update first, insert if no rows exist
    const result = db.update(syncState).set({ syncTimeOffset: safeOffset }).run();
    if (result.changes === 0) {
        db.insert(syncState).values({ syncTimeOffset: safeOffset }).run();
    }
}

function getFailureCount(fileId: string): number {
    const db = getSyncDb();
    const row = db.select().from(applyFailures).where(eq(applyFailures.fileId, fileId)).get();
    return row?.count ?? 0;
}

/**
 * Save (upsert) the failure count for a file.
 * Sets count to exact value rather than incrementing
 * (allows reset to 0 on success).
 */
function saveFailureCount(fileId: string, count: number): void {
    getSyncDb()
        .insert(applyFailures)
        .values({ fileId, count })
        .onConflictDoUpdate({
            target: applyFailures.fileId,
            set: { count },
        })
        .run();
}

function isAlreadyProcessed(fileId: string): boolean {
    const db = getSyncDb();
    return !!db.select().from(processedChanges).where(eq(processedChanges.fileId, fileId)).get();
}

/**
 * Detect Google auth errors (invalid_grant, token revoked, etc.)
 */
function isGoogleAuthError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
        msg.includes('invalid_grant') ||
        msg.includes('token has been expired or revoked') ||
        msg.includes('invalid credentials') ||
        msg.includes('unauthorized')
    );
}

// -----------------------------------------------------------------------
// Processed changes & cleanup helpers
// -----------------------------------------------------------------------

function saveProcessedChange(fileId: string): void {
    getSyncDb().insert(processedChanges).values({ fileId }).onConflictDoNothing().run();
}

function deleteProcessedChange(fileId: string): void {
    getSyncDb().delete(processedChanges).where(eq(processedChanges.fileId, fileId)).run();
}

function cleanupOldSyncRecords(before: string): void {
    const db = getSyncDb();
    db.delete(processedChanges).where(lt(processedChanges.createdAt, before)).run();
    db.delete(applyFailures).where(lt(applyFailures.createdAt, before)).run();
}
