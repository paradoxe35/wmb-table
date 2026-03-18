import '@main/lib/sentry';

import { app, BrowserWindow, session, shell } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { APP_NAME } from '@shared/constants';
import { initializeIpc } from '@main/ipc/register';
import { setMainWindow } from '@main/lib/window';
import MenuBuilder from '@main/lib/menu';
import { initializeLogger } from '@main/lib/logger';
import { initializeUpdater } from '@main/lib/updater';
import { initializeDatabase, closeDatabase } from '@main/database';
import { initializeTantivy, terminateWorker } from '@main/services/tantivy.service';
import { tryStartSynchronizer, stopSynchronizer } from '@main/services/sync/synchronizer';
import { disposeTtsService } from '@main/services/tts';
import { disposeAiService } from '@main/services/ai';
import * as configRepo from '@main/database/repositories/config.repository';
import i18n from '@main/lib/i18n';

// Initialize logger first
initializeLogger();

// Initialize database before IPC handlers
initializeDatabase();

// Set backend i18n language from DB before building menu
const savedUiLanguage = configRepo.getUiLanguage();
if (savedUiLanguage) i18n.changeLanguage(savedUiLanguage);

// Register all IPC handlers before window creation
initializeIpc();

function setupCSP(): void {
    if (is.dev) return;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        "default-src 'self'",
                        "script-src 'self'",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: https:",
                        "font-src 'self' data:",
                        "connect-src 'self' https:",
                    ].join('; '),
                ],
            },
        });
    });
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        show: false,
        width: 1024,
        height: 800,
        minWidth: 933,
        minHeight: 572,
        title: APP_NAME,
        backgroundColor: '#001529',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            spellcheck: false,
        },
    });

    setMainWindow(mainWindow);

    // Show window when ready, maximized (matches legacy behavior)
    mainWindow.on('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    // Open external links in the user's browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Build application menu
    const menuBuilder = new MenuBuilder(mainWindow);
    menuBuilder.buildMenu();

    // TouchBar on macOS
    if (process.platform === 'darwin') {
        import('@main/lib/touch-bar').then(({ createTouchBar }) => {
            mainWindow.setTouchBar(createTouchBar(mainWindow));
        });
    }

    // Auto-updater when packaged
    if (app.isPackaged) {
        initializeUpdater(mainWindow);
    }

    // Load the app
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

app.whenReady().then(async () => {
    setupCSP();
    await initializeTantivy();
    createWindow();
    tryStartSynchronizer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('will-quit', () => {
    stopSynchronizer();
    terminateWorker();
    disposeTtsService();
    disposeAiService();
    closeDatabase();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
