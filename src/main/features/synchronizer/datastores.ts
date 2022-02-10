import { getAppHomePath } from '@root/sys';
// import { SynchronizerAppInstance } from './type';
import { AppInstance } from './collections';
import CustomDatastore from '../custom-datastore';

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
