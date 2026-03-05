import { autoUpdater } from 'electron-updater';
import type { BrowserWindow } from 'electron';
import { PushChannels } from '@shared/ipc.types';
import { sendToRenderer } from '@main/ipc/register';
import type { UpdaterNotification } from '@shared/types';
import log from './logger';

export function initializeUpdater(mainWindow: BrowserWindow): void {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;

    autoUpdater.on('checking-for-update', () => {
        log.info('Updater: checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        const notification: UpdaterNotification = {
            type: 'hasUpdate',
            status: {
                updateInfo: {
                    version: info.version,
                    releaseDate: info.releaseDate,
                    releaseName: info.releaseName ?? null,
                    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
                },
            },
        };
        sendToRenderer(mainWindow, PushChannels.notifyForNewUpdate, notification);
    });

    autoUpdater.on('update-not-available', () => {
        log.info('Updater: no update available');
    });

    autoUpdater.on('download-progress', (progress) => {
        const notification: UpdaterNotification = {
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
        };
        sendToRenderer(mainWindow, PushChannels.notifyForNewUpdate, notification);
    });

    autoUpdater.on('update-downloaded', () => {
        const notification: UpdaterNotification = { type: 'downloaded' };
        sendToRenderer(mainWindow, PushChannels.notifyForNewUpdate, notification);
    });

    autoUpdater.on('error', (err) => {
        const notification: UpdaterNotification = {
            type: 'error',
            message: err.message,
        };
        sendToRenderer(mainWindow, PushChannels.notifyForNewUpdate, notification);
    });

    // Check for updates after a short delay
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            log.error('Updater: failed to check for updates', err);
        });
    }, 3000);
}
