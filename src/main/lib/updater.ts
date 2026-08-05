import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import updater from 'electron-updater';
import { app, type BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { UpdateInfo, UpdaterNotification } from '@shared/types';
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } from './github';
import log from './logger';

const { autoUpdater } = updater;

const FIRST_CHECK_DELAY_MS = 3_000;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_TIMEOUT_MS = 60_000;

/** electron-builder writes this marker only for targets that can self-install */
const SELF_UPDATING_LINUX_PACKAGES = new Set(['deb', 'rpm', 'pacman']);

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
let linuxPackageType: string | null | undefined;

/** Reads the same marker electron-updater uses to pick its updater implementation */
function getLinuxPackageType(): string | null {
    if (linuxPackageType !== undefined) return linuxPackageType;
    try {
        const marker = join(process.resourcesPath, 'package-type');
        linuxPackageType = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null;
    } catch {
        linuxPackageType = null;
    }
    return linuxPackageType;
}

function isSelfUpdatingLinuxPackage(): boolean {
    const packageType = getLinuxPackageType();
    return packageType != null && SELF_UPDATING_LINUX_PACKAGES.has(packageType);
}

function canAutoUpdate(): boolean {
    if (process.platform !== 'linux') return true;
    if (process.env.APPIMAGE) return true;
    return isSelfUpdatingLinuxPackage();
}

/** deb/rpm/pacman install through the system package manager, via pkexec/sudo */
function requiresElevatedInstall(): boolean {
    if (process.platform !== 'linux' || process.env.APPIMAGE) return false;
    return isSelfUpdatingLinuxPackage();
}

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

export function initializeUpdater(mainWindow: BrowserWindow): void {
    // The window may be recreated (macOS activate), so always track the latest
    mainWindowRef = mainWindow;
    mainWindow.on('closed', () => {
        if (mainWindowRef === mainWindow) mainWindowRef = null;
    });

    // Listeners and timers must only ever be registered once
    if (initialized) return;
    initialized = true;

    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    // Installing a deb/rpm/pacman package shells out through pkexec/sudo, and
    // electron-updater does that from its quit handler with no prompt of its own.
    // Keep those installs explicit so quitting never raises a password dialog.
    autoUpdater.autoInstallOnAppQuit = !requiresElevatedInstall();

    // With a token, use the GitHub API provider (works for private and public
    // repos alike). Without one, electron-updater uses the public releases feed.
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
        downloaded = true;
        knownUpdateInfo = toUpdateInfo(info);
        notify({ type: 'downloaded' });
    });

    autoUpdater.on('error', (err) => {
        const message = errorMessage(err);
        const lower = message.toLowerCase();
        downloading = false;
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
        checkForUpdates().catch(() => {
            // Errors are already surfaced through the 'error' event
        });
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
    // Re-decorate so a renderer that started before the updater still learns
    // whether auto-update is enabled and supported here
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
        // The event listeners normally produced the notification already
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
    // Never discard a running or finished download. Re-asserting the downloaded
    // state also brings the install button back after a transient error.
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
    // electron-updater takes several seconds to resolve the release asset before
    // its first 'download-progress' event, so report the state change now
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

    autoUpdater.downloadUpdate().catch((err) => {
        downloading = false;
        log.error('Updater: failed to download update', err);
        notify({ type: 'error', message: errorMessage(err) });
    });

    return pending;
}

export function quitAndInstall(): void {
    if (!downloaded) {
        log.warn('Updater: install requested but no update has been downloaded');
        return;
    }
    // Let the IPC reply flush before the app tears itself down
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
}
