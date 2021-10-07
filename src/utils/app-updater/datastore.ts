import Nedb from '@seald-io/nedb';
import { UpdaterInfoStatus } from '../../types';
import { autoUpdater } from 'electron-updater';
import { app } from 'electron';
import path from 'path';
import { APP_NAME } from '../constants';

export default class UpdaterInMemoryDatastore {
  private datastore: Nedb<UpdaterInfoStatus>;

  constructor() {
    const appName = APP_NAME.toLowerCase().split(' ').join('-');
    this.datastore = new Nedb<UpdaterInfoStatus>({
      filename: path.join(app.getPath('home'), `.${appName}`, `state.db`),
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
      const fresh = ({
        restartedToUpdate: false,
        updateInfo: new Date(),
        version: autoUpdater.currentVersion.version,
      } as unknown) as UpdaterInfoStatus;
      this.datastore.insert(fresh, (err, created) => {
        if (err) {
          return resolve({} as UpdaterInfoStatus);
        }
        return resolve(created);
      });
    });
  }
}
