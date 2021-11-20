import Nedb from '@seald-io/nedb';
import { UpdaterInfoStatus } from '@localtypes/index';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { getAppHomePath } from '@root/sys';

export default class UpdaterInMemoryDatastore {
  private datastore: Nedb<UpdaterInfoStatus>;

  constructor() {
    const homePath = getAppHomePath();
    this.datastore = new Nedb<UpdaterInfoStatus>({
      filename: path.join(homePath, `updater.db`),
      timestampData: true,
    });

    this.datastore.loadDatabase();
  }

  public async instance() {
    let data = await this.data();
    if (!data) {
      data = await this.create();
    }
    return data;
  }

  private data(): Promise<UpdaterInfoStatus | undefined> {
    return new Promise<UpdaterInfoStatus | undefined>((resolve) => {
      this.datastore.findOne({}, {}, (err, document) => {
        if (err) {
          return resolve(undefined);
        }
        resolve(document);
      });
    });
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

  private create() {
    return new Promise<UpdaterInfoStatus>((resolve) => {
      const fresh = {
        restartedToUpdate: false,
        lastUpdateCheck: new Date(),
        version: autoUpdater.currentVersion.version,
      } as UpdaterInfoStatus;
      this.datastore.insert(fresh, (err, created) => {
        if (err) {
          return resolve({} as UpdaterInfoStatus);
        }
        return resolve(created);
      });
    });
  }
}
