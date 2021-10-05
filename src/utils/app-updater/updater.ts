import { AppUpdater, autoUpdater, UpdateCheckResult } from 'electron-updater';
import log from 'electron-log';
import UpdaterInMemoryDatastore from './datastore';
import { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '../ipc-events';
import { mainMessageTransport } from '../../message-control/ipc/ipc-main';
import UpdaterDataPrepared from './data-prepared';
import {
  UpdaterCopyProgress,
  UpdaterInfoStatus,
  UpdaterNotification,
} from '../../types';
import { setUpdaterRestoringData } from './constants';

class Updater {
  private autoUpdater: AppUpdater;
  private datastore: UpdaterInMemoryDatastore;
  private datastoreState?: UpdaterInfoStatus;

  private updateCheckResult?: UpdateCheckResult;
  private restartedToUpdate: boolean = false;

  private isDownloading: boolean = false;

  private CHECK_INTERVAL: number = 1000 * 60 * 5; // check every 5 minutes

  constructor(private mainWindow: BrowserWindow) {
    log.transports.file.level = 'info';
    // auto update logger
    autoUpdater.logger = log;
    // disable auto download with there's availble update
    autoUpdater.autoDownload = false;

    this.autoUpdater = autoUpdater;
    // used to save progress state of updater
    this.datastore = new UpdaterInMemoryDatastore();
    // initialize updater state and call all dependent method
    this.state();
    // listen for download confirmation from rendere process
    mainMessageTransport(IPC_EVENTS.start_download_update, this.startDownload);
    // check update with interval
    this.checkWithInterval();
  }

  private checkWithInterval() {
    setInterval(this.checkForUpdates, this.CHECK_INTERVAL);
  }

  private checkForUpdates = () => {
    this.autoUpdater.checkForUpdates().then(this.notifyHasUpdate);
  };

  private async notifyHasUpdate(result: UpdateCheckResult) {
    if (this.updateCheckResult || this.restartedToUpdate) return;
    // make update result accessible from object
    this.updateCheckResult = result;
    // put in datastore updater state
    this.datastore.update({
      updateCheckResult: result,
      lastUpdateCheck: new Date(),
    });

    this.datastoreState = await this.datastore.instance();
    // send ipc message to renderer process
    this.notifyRenderer({
      type: 'hasUpdate',
      status: this.datastoreState,
    });
  }

  private notifyRenderer(data: UpdaterNotification) {
    // send ipc message to renderer process
    this.mainWindow.webContents.send(IPC_EVENTS.notify_for_new_update, data);
  }

  private async startDownload() {
    if (!this.updateCheckResult || this.isDownloading || this.restartedToUpdate)
      return;

    this.isDownloading = true;

    try {
      // prepare and backup data temporary for update
      const prepareUpdate = new UpdaterDataPrepared(this.updateCheckResult);
      const timeUsed = await prepareUpdate.backup(this.onProgressDataPrepare);

      // now start download update file
    } catch (error) {}
  }

  private onProgressDataPrepare(progress: UpdaterCopyProgress) {}

  private async state() {
    this.datastoreState = await this.datastore.instance();

    this.restartedToUpdate = !!this.datastoreState.restartedToUpdate;
    this.restartedToUpdate && this.restoreOriginalDatas(this.datastoreState);
  }

  private async restoreOriginalDatas(state: UpdaterInfoStatus) {
    setUpdaterRestoringData(true);
  }
}

export default Updater;
