import { UpdateInfo } from 'electron-updater';
import { app } from 'electron';
import copyWithProgress, {
  moveWithProgress,
} from '../main/functions/copy-with-progress';
import { UpdaterCopyProgress } from '../../types';
import path from 'path';
import fs from 'fs-extra';
import { APP_NAME } from '../constants';
import { getAssetDatasPath } from '../../sys';
import custom_documents from '../../message-control/handlers/custom_documents';
import { getFilename } from '../functions';

export default class UpdaterDataPrepared {
  private tempPath: string;
  private dataPath: string;
  private customDocuments: string[] | undefined;

  constructor(private updateInfo: UpdateInfo) {
    this.tempPath = this.tempDir();
    this.dataPath = getAssetDatasPath();
  }

  private tempDir() {
    const appName = APP_NAME.toLowerCase().split(' ').join('-');

    const newDir = path.join(
      app.getPath('temp'),
      appName,
      this.updateInfo.version
    );

    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, {
        recursive: true,
      });
    }

    return newDir;
  }

  public backup(onProgress: (progress: UpdaterCopyProgress) => void) {
    this.customDocuments = undefined;
    return copyWithProgress(this.dataPath, this.tempPath, {
      onProgress,
      overwrite: true,
      filter: this.filterCopy,
    });
  }

  private filterCopy = async (src: string) => {
    if (src.endsWith('.html')) {
      const docs = await this.getCustomDocumentsHtml();
      const filename = getFilename(src);
      if (!docs.includes(filename)) {
        return false;
      }
    }
    return true;
  };

  private async getCustomDocumentsHtml(): Promise<string[]> {
    if (!this.customDocuments) {
      this.customDocuments = (await custom_documents()).map(
        (doc) => `${doc.title}.html`
      );
    }
    return this.customDocuments;
  }

  public restore(onProgress: (progress: UpdaterCopyProgress) => void) {
    return moveWithProgress(this.tempPath, this.dataPath, {
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
