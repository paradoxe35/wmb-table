import { getAppHomePath } from '@root/sys';
import { AppInstance } from './collections';
import CustomDatastore from '../custom-datastore';
// import { TimeStampData } from '@localtypes/index';
import type { BackedUp } from '../backup/handler/backup-handler.d';

// get home path with synchronizer as subdirectory name
const home_dir = () => getAppHomePath('synchronizer');

export class SynchronizerAppInstanceDatastore extends CustomDatastore<
  AppInstance
> {
  constructor() {
    // init datastore and load ite
    super(home_dir(), 'status');
  }
}

export class PendingBackedUpDatastore extends CustomDatastore<BackedUp> {
  constructor() {
    // init datastore and load ite
    super(home_dir(), 'pendings');
  }
}
