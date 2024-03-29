import { UpdaterInfoStatus } from '@localtypes/index';
import { autoUpdater } from 'electron-updater';
import { getAppHomePath } from '@root/sys';
import CustomDatastore from '../custom-datastore';
import { getAppUuid } from '../app-uuid';

export default class UpdaterInMemoryDatastore extends CustomDatastore<
  UpdaterInfoStatus
> {
  private static _instance: UpdaterInMemoryDatastore;
  private refreshed: boolean = false;

  constructor() {
    super(getAppHomePath(getAppUuid().app_id), 'updater');
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new this();
    }
    return this._instance;
  }

  /**
   * Get only one instance from datastore
   *
   * @returns
   */
  public async instance() {
    let data = await this.data();
    if (!data) {
      data = await this.create();
    } else if (!data.restartedToUpdate && !this.refreshed) {
      // alway recreate db datastore instance to awlay get the good update information
      await this.clear_datastore();
      data = await this.create();
      this.refreshed = true;
    }
    return data;
  }

  public async update(data: Partial<UpdaterInfoStatus>) {
    const instance = await this.instance();
    return new Promise<number | undefined>((resolve) => {
      this.datastore.update(
        { _id: instance._id },
        { $set: data },
        { multi: true },
        (err, num) => {
          if (err) {
            return resolve(undefined);
          }
          resolve(num);
        }
      );
    });
  }

  public create() {
    return super.create(<UpdaterInfoStatus>{
      restartedToUpdate: false,
      lastUpdateCheck: new Date(),
      version: autoUpdater.currentVersion.version,
    });
  }
}
