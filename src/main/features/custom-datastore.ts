import path from 'path';
import Nedb from '@seald-io/nedb';
import { DB_EXTENSION } from '@root/utils/constants';

export default class CustomDatastore<T> {
  protected datastore: Nedb<T>;

  constructor(dbpath: string, dbname: string) {
    this.datastore = new Nedb<T>({
      filename: path.join(dbpath, dbname + DB_EXTENSION),
      timestampData: true,
    });

    this.datastore.loadDatabase();
  }

  public data(): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve) => {
      this.datastore.findOne({}, {}, (err, document) => {
        if (err) {
          return resolve(undefined);
        }
        resolve(document as T);
      });
    });
  }

  public datas(): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      this.datastore.find({}, {}, (err, documents) => {
        if (err) {
          return resolve([]);
        }
        resolve(documents as T[]);
      });
    });
  }

  public clear_datastore() {
    return new Promise<number>((resolve) =>
      this.datastore.remove({}, { multi: true }, (_, n) => {
        resolve(n);
      })
    );
  }

  public delete(_id: string) {
    return new Promise<number>((resolve) =>
      this.datastore.remove({ _id }, (_, n) => {
        resolve(n);
      })
    );
  }

  public create(fresh: T) {
    return new Promise<T>((resolve) => {
      this.datastore.insert(fresh, (err, created) => {
        if (err) {
          return resolve({} as T);
        }
        return resolve(created as T);
      });
    });
  }
}
