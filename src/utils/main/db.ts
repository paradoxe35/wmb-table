import Datastore from 'nedb';
import { getAssetPath } from '../../sys';

interface Db {
  history?: Datastore | undefined;
  documents?: Datastore | undefined;
  subject?: Datastore | undefined;
  tabs?: Datastore | undefined;
}

const db: Db = {};

const dbStore = (name: string) =>
  new Datastore({
    filename: getAssetPath(`datas/db/${name}.db`),
    autoload: true,
  });

db.documents = new Datastore({
  filename: getAssetPath(`datas/documents.db`),
  autoload: true,
});

db.history = dbStore('history');
db.subject = dbStore('subject');
db.tabs = dbStore('tabs');

export const queryDb = {
  promiseResolve(resolve: Function, reject: Function) {
    return function (err: any, docs: any) {
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    };
  },
  find<T>(
    database: Datastore | undefined,
    fields = {},
    projection = {}
  ): Promise<T[]> {
    if (!database) return Promise.reject(null);
    return new Promise((resolve, reject) => {
      database.find(fields, projection, this.promiseResolve(resolve, reject));
    });
  },
  findOne<T>(
    database: Datastore | undefined,
    fields = {},
    projection = {}
  ): Promise<T> {
    if (!database) return Promise.reject(null);
    return new Promise((resolve, reject) => {
      database.findOne(
        fields,
        projection,
        this.promiseResolve(resolve, reject)
      );
    });
  },
  insert<T>(database: Datastore | undefined, datas: any): Promise<T> {
    if (!database) return Promise.reject(null);
    return new Promise((resolve, reject) => {
      database.insert(datas, this.promiseResolve(resolve, reject));
    });
  },
  update(
    database: Datastore | undefined,
    query: any,
    updateQuery: any,
    options?: Datastore.UpdateOptions | undefined
  ): Promise<{ numAffected: number }> {
    if (!database) return Promise.reject(null);
    return new Promise((resolve, reject) => {
      database.update(query, updateQuery, options || {}, (err, numAffected) => {
        if (err) {
          reject(err);
        } else {
          resolve({ numAffected });
        }
      });
    });
  },
};

export default db;
