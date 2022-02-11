import { getAppHomePath } from '@root/sys';
import { AppInstance, Data } from './collections';
import CustomDatastore from '../custom-datastore';
import { TimeStampData } from '@localtypes/index';

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

export class PendingDatasDatastore extends CustomDatastore<
  Data & TimeStampData<Date>
> {
  constructor() {
    // init datastore and load ite
    super(home_dir(), 'pendings');
  }
}
