import updater from 'electron-updater';
import { app, type BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { UpdateInfo, UpdaterNotification } from '@shared/types';
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } from './github';
import log from './logger';
import { canAutoUpdate, requiresElevatedInstall } from './updater-platform';

const { autoUpdater, CancellationToken } = updater;

const FIRST_CHECK_DELAY_MS = 3_000;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_TIMEOUT_MS = 60_000;
/** No progress for this long means the transfer is wedged, not merely slow */
const DOWNLOAD_STALL_MS = 90_000;

let mainWindowRef: BrowserWindow | null = null;
let initialized = false;
let firstCheckTimer: NodeJS.Timeout | null = null;
let periodicTimer: NodeJS.Timeout | null = null;

let lastNotification: UpdaterNotification = { type: 'none' };
/** Kept across state transitions so the UI can keep showing the version */
let knownUpdateInfo: UpdateInfo | undefined;
let checkPromise: Promise<UpdaterNotification> | null = null;
let downloading = false;
let downloaded = false;
let downloadCancellation: InstanceType<typeof CancellationToken> | null = null;
let stallTimer: NodeJS.Timeout | null = null;

function isBusy(): boolean {
    return downloading || downloaded;
}

function toUpdateInfo(info: {
    version: string;
    releaseDate: string;
    releaseName?: string | null;
    releaseNotes?: string | Array<unknown> | null;
}): UpdateInfo {
    return {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName ?? null,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    };
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

function decorate(notification: UpdaterNotification): UpdaterNotification {
    return {
        ...notification,
        updateInfo: notification.updateInfo ?? knownUpdateInfo,
        canAutoUpdate: canAutoUpdate(),
        updaterEnabled: initialized,
        requiresElevatedInstall: requiresElevatedInstall(),
        currentVersion: app.getVersion(),
    };
}

function notify(notification: UpdaterNotification): UpdaterNotification {
    lastNotification = decorate(notification);
    if (mainWindowRef) {
        sendToRenderer(mainWindowRef, PushChannels.notifyForNewUpdate, lastNotification);
    }
    return lastNotification;
}

function clearStallWatchdog(): void {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
}

/** Single exit for a download, so no failure path can leave the UI mid-transfer. */
function endDownload(result: UpdaterNotification): UpdaterNotification | null {
    if (!downloading) return null;
    clearStallWatchdog();
    downloading = false;
    downloadCancellation = null;
    return notify(result);
}

/**
 * electron-updater can leave `downloadUpdate()` pending forever with no progress
 * and no rejection. Without this the reader sits on a spinner it can never leave.
 */
function armStallWatchdog(): void {
    clearStallWatchdog();
    stallTimer = setTimeout(() => {
        if (!downloading) return;
        log.error('Updater: download stalled, cancelling');
        downloadCancellation?.cancel();
        endDownload({
            type: 'error',
            message: `No data received for ${DOWNLOAD_STALL_MS / 1000}s — the download was cancelled`,
        });
    }, DOWNLOAD_STALL_MS);
}

export function initializeUpdater(mainWindow: BrowserWindow): void {
    // The window may be recreated (macOS activate)
    mainWindowRef = mainWindow;
    mainWindow.on('closed', () => {
        if (mainWindowRef === mainWindow) mainWindowRef = null;
    });

    // Listeners and timers must only ever be registered once
    if (initialized) return;
    initialized = true;

    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    // Differential downloads are the common cause of a transfer that emits no
    // progress and never settles
    autoUpdater.disableDifferentialDownload = true;
    autoUpdater.disableWebInstaller = true;
    // deb/rpm/pacman install via pkexec/sudo, and electron-updater does that from
    // its quit handler — keep it explicit so quitting never raises a password dialog
    autoUpdater.autoInstallOnAppQuit = !requiresElevatedInstall();

    // With a token, use the GitHub API provider; without one, the public feed
    if (GITHUB_TOKEN) {
        process.env.GH_TOKEN = GITHUB_TOKEN;
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            private: true,
            token: GITHUB_TOKEN,
        });
    }

    autoUpdater.on('checking-for-update', () => {
        log.info('Updater: checking for update...');
        if (!isBusy()) notify({ type: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        log.info(`Updater: update available (${info.version})`);
        knownUpdateInfo = toUpdateInfo(info);
        if (isBusy()) return;
        notify({ type: 'hasUpdate', updateInfo: knownUpdateInfo });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('Updater: no update available');
        if (isBusy()) return;
        knownUpdateInfo = undefined;
        notify({ type: 'noUpdate' });
    });

    autoUpdater.on('download-progress', (progress) => {
        downloading = true;
        armStallWatchdog();
        notify({
            type: 'downloading',
            progress: {
                downloadProgress: {
                    total: progress.total,
                    delta: progress.delta,
                    transferred: progress.transferred,
                    percent: progress.percent,
                    bytesPerSecond: progress.bytesPerSecond,
                },
            },
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info(`Updater: update downloaded (${info.version})`);
        downloading = false;
        clearStallWatchdog();
        downloaded = true;
        knownUpdateInfo = toUpdateInfo(info);
        notify({ type: 'downloaded' });
    });

    autoUpdater.on('error', (err) => {
        const message = errorMessage(err);
        const lower = message.toLowerCase();
        downloading = false;
        clearStallWatchdog();
        // A missing release is a normal state, not a failure worth showing
        if (
            lower.includes('404') ||
            lower.includes('no published') ||
            lower.includes('not found')
        ) {
            log.info('Updater: no published release found');
            if (!downloaded) notify({ type: 'noUpdate' });
            return;
        }
        log.error('Updater error', err);
        notify({ type: 'error', message });
    });

    const check = () => {
        checkForUpdates().catch(() => {});
    };

    // An install that cannot self-update has nothing to act on, so don't poll
    if (canAutoUpdate()) {
        firstCheckTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
        periodicTimer = setInterval(check, CHECK_INTERVAL_MS);
    } else {
        log.info('Updater: this installation type cannot update itself');
    }

    app.on('will-quit', () => {
        if (firstCheckTimer) clearTimeout(firstCheckTimer);
        if (periodicTimer) clearInterval(periodicTimer);
        firstCheckTimer = null;
        periodicTimer = null;
    });
}

export function getUpdateStatus(): UpdaterNotification {
    // Re-decorate so a renderer that started first still learns what is supported
    return decorate(lastNotification);
}

const TIMED_OUT = Symbol('updater-check-timeout');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
    return Promise.race([
        promise,
        new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), ms)),
    ]);
}

async function runCheck(): Promise<UpdaterNotification> {
    try {
        const result = await withTimeout(autoUpdater.checkForUpdates(), CHECK_TIMEOUT_MS);
        if (result === TIMED_OUT) {
            return notify({ type: 'error', message: 'Update check timed out' });
        }
        // null means electron-updater declined to check for this install type
        if (result === null) {
            log.info('Updater: checks are not supported for this installation type');
            return notify({ type: 'noUpdate' });
        }
        if (lastNotification.type === 'checking') {
            return notify({ type: 'noUpdate' });
        }
        return lastNotification;
    } catch (err) {
        if (lastNotification.type === 'checking') {
            return notify({ type: 'error', message: errorMessage(err) });
        }
        return lastNotification;
    }
}

export async function checkForUpdates(): Promise<UpdaterNotification> {
    if (!initialized) return getUpdateStatus();
    // Re-asserting `downloaded` also brings the install button back after an error
    if (downloaded) return notify({ type: 'downloaded' });
    if (downloading) return lastNotification;
    if (checkPromise) return checkPromise;

    checkPromise = runCheck().finally(() => {
        checkPromise = null;
    });
    return checkPromise;
}

export async function startDownload(): Promise<UpdaterNotification> {
    if (!initialized) return getUpdateStatus();
    if (!canAutoUpdate()) {
        return notify({ type: 'error', message: 'Auto-update is not supported by this install' });
    }
    if (downloaded) return notify({ type: 'downloaded' });
    if (downloading) return lastNotification;

    if (!knownUpdateInfo) {
        const status = await checkForUpdates();
        if (status.type !== 'hasUpdate') return status;
    }

    downloading = true;
    downloadCancellation = new CancellationToken();
    armStallWatchdog();
    // Resolving the release asset takes seconds before the first progress event
    const pending = notify({
        type: 'downloading',
        progress: {
            downloadProgress: {
                total: 0,
                delta: 0,
                transferred: 0,
                percent: 0,
                bytesPerSecond: 0,
            },
        },
    });

    autoUpdater
        .downloadUpdate(downloadCancellation)
        .then(() => {
            // 'update-downloaded' owns success; reaching here means no file was produced
            endDownload({
                type: 'error',
                message: 'The download completed but produced no installer',
            });
        })
        .catch((err) => {
            log.error('Updater: failed to download update', err);
            endDownload({ type: 'error', message: errorMessage(err) });
        });

    return pending;
}

export function cancelDownload(): UpdaterNotification {
    if (!downloading) return lastNotification;

    log.info('Updater: download cancelled by user');
    downloadCancellation?.cancel();
    return endDownload({ type: 'hasUpdate' }) ?? lastNotification;
}

export function quitAndInstall(): void {
    if (!downloaded) {
        log.warn('Updater: install requested but no update has been downloaded');
        return;
    }
    // Let the IPC reply flush before the app tears itself down
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
}
