import updater from 'electron-updater';
import { app, type BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/ipc-bridge';
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
let silentCheck = false;

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

/** Chromium and Node surface a lot of names for "the network moved under us" */
function isTransientNetworkError(message: string): boolean {
    return /net::ERR_|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|getaddrinfo/i.test(
        message,
    );
}

/** electron-updater appends a stack; only the first line is fit for a user */
function firstLine(message: string): string {
    return message.split('\n')[0].trim();
}

/** The single place a failure becomes what the reader sees, whoever caught it */
function classifyError(err: unknown): UpdaterNotification {
    const message = errorMessage(err);
    const lower = message.toLowerCase();
    // A missing release is a normal state when checking, but never mid-transfer
    if (
        !downloading &&
        (lower.includes('404') || lower.includes('no published') || lower.includes('not found'))
    ) {
        log.info('Updater: no published release found');
        return { type: 'noUpdate' };
    }
    if (isTransientNetworkError(message)) {
        log.warn(`[updater] network unavailable: ${firstLine(message)}`);
        return { type: 'error', errorKind: 'network', message: 'Connexion indisponible' };
    }
    // Keep the stack: it is the only thing that names the provider that failed
    log.error('Updater error', err);
    return { type: 'error', errorKind: 'generic', message: firstLine(message) };
}

/** A background check must not interrupt the reader over a dropped wifi */
function isSuppressed(result: UpdaterNotification): boolean {
    return silentCheck && !downloading && result.errorKind === 'network';
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
            errorKind: 'generic',
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

    // electron-updater reports the resolved asset URL, redirects and HTTP statuses
    // at debug level, which the file transport drops. Promote them: without this a
    // stalled download leaves no evidence of what it was talking to.
    autoUpdater.logger = {
        debug: (message: string) => log.info(`[updater] ${message}`),
        info: (message: string) => log.info(`[updater] ${message}`),
        warn: (message: string) => log.warn(`[updater] ${message}`),
        error: (message: string) => log.error(`[updater] ${message}`),
    };
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
        const result = classifyError(err);
        // An already-downloaded update stays installable whatever happens next
        if (downloaded || isSuppressed(result)) return;
        if (!endDownload(result)) notify(result);
    });

    const check = () => {
        checkForUpdates({ silent: true }).catch(() => {});
    };

    // An install that cannot self-update has nothing to act on, so don't poll
    log.info(
        `[updater] platform=${process.platform} feed=${GITHUB_TOKEN ? 'github-api (private)' : 'github public'} version=${app.getVersion()}`,
    );

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
            return notify({
                type: 'error',
                errorKind: 'generic',
                message: 'Update check timed out',
            });
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
        // The 'error' event already reported anything that reached a later state
        if (lastNotification.type !== 'checking') return lastNotification;
        const result = classifyError(err);
        return notify(isSuppressed(result) ? { type: 'none' } : result);
    }
}

export async function checkForUpdates(options?: {
    silent?: boolean;
}): Promise<UpdaterNotification> {
    if (!initialized) return getUpdateStatus();
    // Re-asserting `downloaded` also brings the install button back after an error
    if (downloaded) return notify({ type: 'downloaded' });
    if (downloading) return lastNotification;
    if (checkPromise) return checkPromise;

    silentCheck = options?.silent ?? false;
    checkPromise = runCheck().finally(() => {
        checkPromise = null;
        silentCheck = false;
    });
    return checkPromise;
}

export async function startDownload(): Promise<UpdaterNotification> {
    if (!initialized) return getUpdateStatus();
    if (!canAutoUpdate()) {
        return notify({
            type: 'error',
            errorKind: 'generic',
            message: 'Auto-update is not supported by this install',
        });
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

    // downloadUpdate() resolves the release asset synchronously, so a bad manifest
    // throws before any promise exists to catch. An async scope turns that back
    // into a rejection instead of leaving the UI on a spinner until the watchdog.
    void (async () => {
        try {
            await autoUpdater.downloadUpdate(downloadCancellation);
            // 'update-downloaded' owns success; reaching here means no file was produced
            endDownload({
                type: 'error',
                errorKind: 'generic',
                message: 'The download completed but produced no installer',
            });
        } catch (err) {
            endDownload(classifyError(err));
        }
    })();

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
