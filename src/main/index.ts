import '@main/lib/sentry';

import { app, BrowserWindow, protocol, session, shell } from 'electron';
import { join, resolve } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { APP_NAME } from '@shared/constants';
import { initializeIpc } from '@main/ipc/register';
import { setMainWindow } from '@main/lib/window';
import MenuBuilder from '@main/lib/menu';
import { initializeLogger } from '@main/lib/logger';
import { initializeUpdater } from '@main/lib/updater';
import { initializeDatabase, closeDatabase } from '@main/database';
import { initializeTantivy, terminateWorker } from '@main/services/tantivy.service';
import { refreshInstalledLanguageUpdates } from '@main/services/language-pack.service';
import { tryStartSynchronizer, stopSynchronizer } from '@main/services/sync/synchronizer';
import { disposeTtsService } from '@main/services/tts';
import { disposeAiService } from '@main/services/ai';
import * as configRepo from '@main/database/repositories/config.repository';
import { getAudioCacheDir, getTtsCacheDir } from '@main/lib/app-paths';
import i18n from '@main/lib/i18n';
import log from '@main/lib/logger';
import { resolveUiLanguage } from '@shared/constants';

// Initialize logger first
initializeLogger();

// Initialize database before IPC handlers
initializeDatabase();

// Set backend i18n language from DB before building menu
const config = configRepo.getConfig();
const uiLang = resolveUiLanguage(config?.uiLanguage, config?.contentLanguage);
i18n.changeLanguage(uiLang);

// Register custom protocol for serving cached audio files.
// Must be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'audio-cache',
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
    {
        scheme: 'tts-cache',
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
]);

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
                        "media-src 'self' blob: https: audio-cache: tts-cache:",
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

    const registerLocalMediaProtocol = (scheme: 'audio-cache' | 'tts-cache', rootDir: string) => {
        protocol.registerFileProtocol(scheme, (request, callback) => {
            const { pathname } = new URL(request.url);
            const relativePath = pathname
                .split('/')
                .filter(Boolean)
                .map((part) => decodeURIComponent(part))
                .join('/');
            const filePath = resolve(rootDir, relativePath);

            if (!filePath.startsWith(resolve(rootDir))) {
                callback({ error: -10 });
                return;
            }

            callback(filePath);
        });
    };

    // Serve cached audio files via audio-cache://file/<filename>.
    // registerFileProtocol delegates file serving to Chromium which handles
    // range requests and seeking natively (protocol.handle has a known
    // seeking bug: https://github.com/electron/electron/issues/38749).
    registerLocalMediaProtocol('audio-cache', getAudioCacheDir());
    registerLocalMediaProtocol('tts-cache', getTtsCacheDir());

    await initializeTantivy(config?.contentLanguage ?? null);
    void refreshInstalledLanguageUpdates().catch((error) => {
        log.warn('[language-pack] Background update check failed:', error);
    });
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
