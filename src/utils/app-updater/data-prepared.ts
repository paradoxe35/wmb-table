import { UpdateCheckResult } from 'electron-updater';
import { app } from 'electron';
import copyWithProgress from '../main/functions/copy-with-progress';
import { UpdaterCopyProgress } from '../../types';
import path from 'path';
import fs from 'fs-extra';
import { APP_NAME } from '../constants';
import { getAssetDatasPath } from '../../sys';

export default class UpdaterDataPrepared {
  private tempPath: string;
  private dataPath: string;

  constructor(private updateCheckResult: UpdateCheckResult) {
    this.tempPath = this.tempDir();
    this.dataPath = getAssetDatasPath();
  }

  private tempDir() {
    const appName = APP_NAME.toLowerCase().split(' ').join('-');

    const newDir = path.join(
      app.getPath('temp'),
      appName,
      this.updateCheckResult.updateInfo.version
    );

    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, {
        recursive: true,
      });
    }

    return newDir;
  }

  public backup(onProgress: (progress: UpdaterCopyProgress) => void) {
    return copyWithProgress(this.dataPath, this.tempPath, {
      onProgress,
      overwrite: true,
    });
  }

  public restore(onProgress: (progress: UpdaterCopyProgress) => void) {
    return copyWithProgress(this.tempPath, this.dataPath, {
      onProgress,
      overwrite: true,
    });
  }

  public async clear() {
    if (fs.existsSync(this.tempPath)) {
      await fs.rm(this.tempPath, { recursive: true, force: true });
    }
  }
}
