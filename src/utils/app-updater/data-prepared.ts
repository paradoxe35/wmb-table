import { UpdateCheckResult } from 'electron-updater';
import { app } from 'electron';
import copyWithProgress from '../main/functions/copy-with-progress';
import { UpdaterCopyProgress } from '../../types';
import path from 'path';
import { APP_NAME } from '../constants';
import { getAssetDatasPath } from '../../sys';

export default class UpdaterDataPrepared {
  private tempPath: string;
  private dataPath: string;

  constructor(private updateCheckResult: UpdateCheckResult) {
    const appName = APP_NAME.toLowerCase().split(' ').join('-');

    this.tempPath = path.resolve(
      app.getPath('temp'),
      appName,
      this.updateCheckResult.updateInfo.version
    );

    this.dataPath = getAssetDatasPath();
  }

  public backup(onProgress: (progress: UpdaterCopyProgress) => void) {
    return copyWithProgress(this.dataPath, this.tempPath, { onProgress });
  }
}
