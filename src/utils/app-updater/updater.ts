import { AppUpdater, autoUpdater, UpdateCheckResult } from 'electron-updater';
import log from 'electron-log';
import UpdaterInMemoryDatastore from './datastore';
import { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '../ipc-events';
import { mainMessageTransport } from '../../message-control/ipc/ipc-main';

class Updater {
  autoUpdater: AppUpdater;
  datastore: UpdaterInMemoryDatastore;
  isUpdating: boolean = false;
  hasNewUpdated: boolean = false;

  constructor(private mainWindow: BrowserWindow) {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;

    this.autoUpdater = autoUpdater;
    // used to save progress state of updater
    this.datastore = new UpdaterInMemoryDatastore();
    // check direct for update
    this.checkForUpdates();
    // listen for download confirmation from rendere process
    mainMessageTransport(IPC_EVENTS.start_download_update, this.startDownload);
  }

  private checkForUpdates() {
    this.autoUpdater.checkForUpdates().then(this.notifyHasUpdate);
  }

  private notifyHasUpdate(result: UpdateCheckResult) {
    this.hasNewUpdated = true;
    // send ipc message to renderer process
    this.mainWindow.webContents.send(IPC_EVENTS.notify_for_new_update, result);
  }

  private startDownload() {
    if (!this.hasNewUpdated) return;
  }
}

export default Updater;
