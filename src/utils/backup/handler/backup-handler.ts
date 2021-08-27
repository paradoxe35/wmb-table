import { DriveHandler } from './drive-handler';
import fsPromises from 'fs/promises';
import fs from 'fs';
import { getAssetBackupPendingPath } from '../../../sys';

export class BackupHandler extends DriveHandler {
  static async handle() {
    const dir = getAssetBackupPendingPath();

    if (!fs.existsSync(dir)) return;

    const files = await fsPromises.readdir(dir);

    return await new Promise<void>((resolve) => {});
  }
}
