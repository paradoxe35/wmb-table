/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import './utils/polyfill';
import 'reflect-metadata';
import { app, BrowserWindow, shell } from 'electron';
import MenuBuilder from './main/platforms/menu';
import { getAssetPath, setMainWindow } from './sys';
import Dialogs from '@main/dialogs/dialogs';
import { APP_NAME } from './utils/constants';
import Updater from './main/features/app-updater/updater';
import { touchBar } from './main/platforms/darwin/touch-bar';
import backupHandler from // backupEventEmiter,
'./main/features/backup/backup';
// import synchronizer from '@main/features/synchronizer/synchronizer';
// import { RESTORE_COMPLETED_EVENT } from '@main/features/backup/constants';

// import all ipc message request handler
require('@main/message-control/main-messages');

// init backup watcher files
const watcher = backupHandler();

/**
 * Call the synchronizer start function after the backup restoration has been completed
 */
// backupEventEmiter.once(RESTORE_COMPLETED_EVENT, synchronizer.start);

/**
 * declare mainWindow at top level to reuse on multiple scope
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Install sourceMapSupport when in production
 */
if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

/**
 * disable ELECTRON SECURITY WARNINGS
 */
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

/**
 * Install all necessary electron devtools for development
 *
 * @returns
 */
const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 800,
    title: APP_NAME,
    minHeight: 572,
    minWidth: 933,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      spellcheck: false,
      contextIsolation: false,
    },
  });

  if (process.platform === 'darwin') {
    mainWindow.setTouchBar(touchBar());
  }

  setMainWindow(mainWindow);

  Dialogs(mainWindow);

  mainWindow.maximize();

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((event) => {
    shell.openExternal(event.url);
    return {
      action: 'deny',
    };
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    // call auto update
    if (app.isPackaged) {
      new Updater(mainWindow);
    }

    // start the synchronization process here
    // synchronizer.start();
  });
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // set mainWindow to null to recreate a new window, in case of macOs which keep app in memory
  mainWindow = null;

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // close watcher file updater only on app will quit event
  watcher.close();
  // close and cancel all synchronization process
  // synchronizer.close();
});

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
