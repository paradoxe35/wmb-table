import {
  AppUpdater,
  autoUpdater,
  UpdateCheckResult,
  UpdateDownloadedEvent,
} from 'electron-updater';
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
import { ProgressInfo } from 'electron-updater/node_modules/builder-util-runtime';

class Updater {
  private autoUpdater: AppUpdater;
  private datastore: UpdaterInMemoryDatastore;
  private datastoreState?: UpdaterInfoStatus;

  private updateCheckResult?: UpdateCheckResult;
  private restartedToUpdate: boolean = false;

  private isDownloading: boolean = false;

  private isDownloaded: boolean = false;

  private CHECK_INTERVAL: number = 1000 * 60 * 3; // check every 3 minutes

  private CALLBACK_TIMEOUT = 3000;

  constructor(private mainWindow: BrowserWindow) {
    log.transports.file.level = 'info';
    // auto update logger
    autoUpdater.logger = log;
    log.info('App starting...');
    // disable auto download with there's availble update
    autoUpdater.autoDownload = false;

    this.autoUpdater = autoUpdater;
    // used to save progress state of updater
    this.datastore = new UpdaterInMemoryDatastore();
    // initialize updater state and call all dependent method
    this.state();
    // listen for download confirmation from rendere process
    mainMessageTransport(IPC_EVENTS.start_download_update, this.startDownload);

    // listen for download confirmation from rendere process
    mainMessageTransport(
      IPC_EVENTS.quit_and_install_update,
      this.quitAndInstall
    );
    // check update with interval
    this.checkWithInterval();
    // track when update downloaded
    this.autoUpdater.on('update-downloaded', this.updateDownloaded);
    // track download progress
    this.autoUpdater.on('download-progress', this.downloadProgress);
  }

  private checkWithInterval() {
    setInterval(this.checkForUpdates, this.CHECK_INTERVAL);
  }

  private checkForUpdates = async () => {
    if (this.updateCheckResult || this.restartedToUpdate) return;
    this.autoUpdater.checkForUpdates().then(this.notifyHasUpdate);
  };

  private notifyHasUpdate = async (result: UpdateCheckResult) => {
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
    });
  };

  private updateDownloaded = (info: UpdateDownloadedEvent) => {
    this.isDownloaded = true;
    // send ipc message to renderer process about downloaded update
    this.notifyRenderer({
      type: 'downloaded',
      message: info.stagingPercentage?.toString(),
    });
  };

  private downloadProgress = (info: ProgressInfo) => {
    // send ipc message to renderer process about backup temp process
    this.notifyRenderer({
      type: 'downloading',
      progress: {
        downloadProgress: info,
      },
    });
  };

  private notifyRenderer(data: UpdaterNotification) {
    // send ipc message to renderer process
    this.mainWindow.webContents.send(IPC_EVENTS.notify_for_new_update, {
      status: this.datastoreState,
      ...data,
    });
  }

  private quitAndInstall = async () => {
    if (this.isDownloaded) {
      // set restartedToUpdate to true so then when the application will updated to restore tha datas
      await this.datastore.update({
        restartedToUpdate: true,
      });

      // now quit and install the update
      this.autoUpdater.quitAndInstall();
    }
  };

  private startDownload = async () => {
    if (!this.updateCheckResult || this.isDownloading || this.restartedToUpdate)
      return;

    this.isDownloading = true;

    try {
      // prepare and backup data temporary for update
      const prepareUpdate = new UpdaterDataPrepared(this.updateCheckResult);
      const timeUsed = await prepareUpdate.backup(this.onProgressDataPrepare);
      // notify renderer process, preparation has finished
      this.notifyRenderer({
        type: 'prepared',
        message: timeUsed,
      });
      // now start download update file
      setTimeout(this.downloadUpdate, this.CALLBACK_TIMEOUT);
    } catch (error) {
      this.notifyRenderer({
        type: 'error',
      });
      console.error(error?.message || error);
    }
  };

  private downloadUpdate = () => {
    this.autoUpdater.downloadUpdate();
  };

  private onProgressDataPrepare = (progress: UpdaterCopyProgress) => {
    // send ipc message to renderer process about backup temp process
    this.notifyRenderer({
      type: 'preparing',
      progress: {
        copyProgress: progress,
      },
    });
  };

  private async state() {
    this.datastoreState = await this.datastore.instance();

    this.notifyRenderer({
      type: 'none',
    });

    this.restartedToUpdate = !!this.datastoreState.restartedToUpdate;

    if (this.restartedToUpdate) {
      this.notifyRenderer({
        type: 'restartedToUpdate',
        status: this.datastoreState,
      });

      setTimeout(() => {
        this.datastoreState && this.restoreOriginalDatas(this.datastoreState);
      }, this.CALLBACK_TIMEOUT);
    }
  }

  private onProgressDataRestoring = (progress: UpdaterCopyProgress) => {
    // send ipc message to renderer process about restoring temp process
    this.notifyRenderer({
      type: 'restoring',
      progress: {
        copyProgress: progress,
      },
    });
  };

  private async restoreOriginalDatas(state: UpdaterInfoStatus) {
    setUpdaterRestoringData(true);
    // prepare and backup data temporary for update
    const prepareUpdate = new UpdaterDataPrepared(
      state.updateCheckResult as UpdateCheckResult
    );
    const timeUsed = await prepareUpdate.restore(this.onProgressDataRestoring);

    this.notifyRenderer({
      type: 'restored',
      message: timeUsed,
    });

    this.datastore.update({
      restartedToUpdate: false,
    });

    setUpdaterRestoringData(false);
    // delete all temp files after restored
    prepareUpdate.clear();
  }
}

export default Updater;
