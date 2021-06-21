import Datastore from 'nedb';
import { getAssetPath } from '../../sys';

interface Db {
  history?: Datastore | undefined;
  historyItem?: Datastore | undefined;
  documents?: Datastore | undefined;
  subjects?: Datastore | undefined;
  subjectItems?: Datastore | undefined;
  tabs?: Datastore | undefined;
  suggestions?: Datastore | undefined;
  customDocuments?: Datastore | undefined;

  notes?: Datastore | undefined;
  notesReference?: Datastore | undefined;
  bible?: Datastore | undefined;
}

const db: Db = {};
const databases: Datastore<any>[] = [];

db.documents = new Datastore({
  filename: getAssetPath(`datas/documents.db`),
  autoload: false,
});

db.bible = new Datastore({
  filename: getAssetPath(`datas/bible/bible.db`),
  autoload: false,
});

const dbStore = (name: string) =>
  new Datastore({
    filename: getAssetPath(`datas/db/${name}.db`),
    autoload: false,
    timestampData: true,
  });

export const loadDatabase = function (database: Datastore<any> | undefined) {
  if (database && !databases.includes(database)) {
    database.loadDatabase();
    databases.push(database);
  }
};

db.history = dbStore('history');
db.historyItem = dbStore('history-item');
db.subjects = dbStore('subjects');
db.subjectItems = dbStore('subject-items');
db.tabs = dbStore('tabs');
db.suggestions = dbStore('suggestions');
db.customDocuments = dbStore('custom-documents');
db.notes = dbStore('notes');
db.notesReference = dbStore('notes-reference');

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
    loadDatabase(database);
    return new Promise((resolve, reject) => {
      database.find(fields, projection, this.promiseResolve(resolve, reject));
    });
  },
  count(database: Datastore | undefined, fields = {}): Promise<number> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
    return new Promise((resolve, reject) => {
      database.count(fields, this.promiseResolve(resolve, reject));
    });
  },
  findOne<T>(
    database: Datastore | undefined,
    fields = {},
    projection = {}
  ): Promise<T> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
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
    loadDatabase(database);
    return new Promise((resolve, reject) => {
      database.insert(datas, this.promiseResolve(resolve, reject));
    });
  },
  remove<T>(
    database: Datastore | undefined,
    query = {},
    options: Datastore.RemoveOptions = {}
  ): Promise<T> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
    return new Promise((resolve, reject) => {
      database.remove(query, options, this.promiseResolve(resolve, reject));
    });
  },
  update(
    database: Datastore | undefined,
    query: any,
    updateQuery: any,
    options?: Datastore.UpdateOptions | undefined
  ): Promise<{ numAffected: number }> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
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
