import updater from 'electron-updater';
import type { BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { UpdaterNotification } from '@shared/types';
import { GITHUB_TOKEN } from './github';
import log from './logger';

const { autoUpdater } = updater;
let lastNotification: UpdaterNotification = { type: 'none' };
let mainWindowRef: BrowserWindow | null = null;

function notify(notification: UpdaterNotification): void {
    lastNotification = notification;
    if (mainWindowRef) {
        sendToRenderer(mainWindowRef, PushChannels.notifyForNewUpdate, notification);
    }
}

export function initializeUpdater(mainWindow: BrowserWindow): void {
    mainWindowRef = mainWindow;
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // For private GitHub repos, electron-updater needs the token passed via
    // GH_TOKEN env var so it uses PrivateGitHubProvider instead of the public one.
    if (GITHUB_TOKEN && !process.env.GH_TOKEN) {
        process.env.GH_TOKEN = GITHUB_TOKEN;
    }

    autoUpdater.on('checking-for-update', () => {
        log.info('Updater: checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        notify({
            type: 'hasUpdate',
            updateInfo: {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseName: info.releaseName ?? null,
                releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
            },
        });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('Updater: no update available');
        notify({ type: 'noUpdate' });
    });

    autoUpdater.on('download-progress', (progress) => {
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

    autoUpdater.on('update-downloaded', () => {
        notify({ type: 'downloaded' });
    });

    autoUpdater.on('error', (err) => {
        const msg = err.message?.toLowerCase() ?? '';
        // Treat "no published release" / 404 as "no update" instead of error
        if (msg.includes('404') || msg.includes('no published') || msg.includes('not found')) {
            log.info('Updater: no published release found');
            notify({ type: 'noUpdate' });
        } else {
            notify({ type: 'error', message: err.message });
        }
    });

    const check = () => {
        autoUpdater.checkForUpdates().catch(() => {
            // Errors are already handled by the 'error' event above
        });
    };

    // Check after a short delay, then every 30 minutes
    setTimeout(check, 3000);
    setInterval(check, 30 * 60 * 1000);
}

export function getUpdateStatus(): UpdaterNotification {
    return lastNotification;
}

export function checkForUpdates(): void {
    if (!mainWindowRef) {
        notify({ type: 'noUpdate' });
        return;
    }
    autoUpdater.checkForUpdates().catch(() => {
        // Errors are already handled by the 'error' event listener
    });
}

export function startDownload(): void {
    if (!mainWindowRef) return;
    autoUpdater.downloadUpdate().catch((err) => {
        log.error('Updater: failed to start download', err);
        notify({ type: 'error', message: err.message });
    });
}

export function quitAndInstall(): void {
    if (!mainWindowRef) return;
    autoUpdater.quitAndInstall(false, true);
}
