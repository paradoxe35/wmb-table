import { getAppHomePath } from '@root/sys';
import { AppInstance } from './collections';
import CustomDatastore from '../custom-datastore';
import type { BackedUp } from '../backup/handler/backup-handler.d';
import { getAppUuid } from '../app-uuid';
import { TimeStampType } from './type';

// get home path with synchronizer as subdirectory name
const home_dir = () => getAppHomePath(getAppUuid().app_id, 'synchronizer');

export class SynchronizerAppInstanceDatastore extends CustomDatastore<
  AppInstance
> {
  constructor() {
    // init datastore and load ite
    super(home_dir(), 'status');
  }

  async updateDataCursor(appInstance: AppInstance) {
    const instance = (await this.data()) as TimeStampType<AppInstance>;
    if (!instance) return;
    return new Promise<number>((resolve) => {
      return this.datastore.update(
        { _id: instance._id },
        { $set: appInstance },
        { multi: true },
        (_err, numberOfUpdated) => {
          resolve(numberOfUpdated);
        }
      );
    });
  }
}

export class PendingBackedUpDatastore extends CustomDatastore<BackedUp> {
  constructor() {
    // init datastore and load ite
    super(home_dir(), 'pendings');
  }
}
