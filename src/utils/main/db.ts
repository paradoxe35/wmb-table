import Datastore from 'nedb';
import {
  getAssetBackupPath,
  getAssetBiblePath,
  getAssetDbPath,
  getAssetDocumentsDbPath,
} from '../../sys';
import { loadedDb, PendingDatasUnloadDb } from '../backup/backup';
import { DB_EXTENSION } from '../constants';
import { getFilename } from '../functions';

interface Db {
  [name: string]: Datastore | undefined;

  configurations?: Datastore;
  history?: Datastore;
  historyItem?: Datastore;
  documents?: Datastore;
  documentsTitle?: Datastore;
  subjects?: Datastore;
  sidebarStatus?: Datastore;
  subjectItems?: Datastore;
  tabs?: Datastore;
  suggestions?: Datastore;
  customDocuments?: Datastore;

  notes?: Datastore;
  notesReference?: Datastore;
  notesBibleReference?: Datastore;
  bible?: Datastore;

  backupDbReferences?: Datastore;
  backupStatus?: Datastore;
}

const db: Db = {};
const databases: Datastore<any>[] = [];

export const getDatastoreFileName = (
  datastore: (Datastore<any> & { filename?: string }) | undefined,
  extension: boolean = true
) => {
  if (!datastore || !datastore.filename) return null;
  const filename = getFilename(datastore.filename);
  return extension ? filename : filename.split(DB_EXTENSION)[0];
};

export const loadDatabase = function (database: Datastore<any> | undefined) {
  if (database && !databases.includes(database)) {
    database.loadDatabase();
    databases.push(database);
    loadedDb.loadDb(database);
  }
};

const dbStore = (name: string) =>
  new Datastore({
    filename: getAssetDbPath(name + DB_EXTENSION),
    autoload: false,
    timestampData: true,
  });

db.documents = new Datastore({
  filename: getAssetDocumentsDbPath(`documents${DB_EXTENSION}`),
  autoload: false,
});

db.documentsTitle = new Datastore({
  filename: getAssetDocumentsDbPath(`documents-title${DB_EXTENSION}`),
  autoload: false,
});

db.bible = new Datastore({
  filename: getAssetBiblePath(`bible${DB_EXTENSION}`),
  autoload: false,
});

db.backupDbReferences = new Datastore({
  filename: getAssetBackupPath(`backup-db-references${DB_EXTENSION}`),
  autoload: false,
});

db.backupStatus = new Datastore({
  filename: getAssetBackupPath(`backup-status${DB_EXTENSION}`),
  autoload: false,
});

db.configurations = dbStore('configurations');
db.history = dbStore('history');
db.historyItem = dbStore('history-item');
db.subjects = dbStore('subjects');
db.subjectItems = dbStore('subject-items');
db.tabs = dbStore('tabs');
db.suggestions = dbStore('suggestions');
db.sidebarStatus = dbStore('sidebar-status');
db.customDocuments = dbStore('custom-documents');
db.notes = dbStore('notes');
db.notesReference = dbStore('notes-reference');
db.notesBibleReference = dbStore('notes-bible-reference');

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

  async insert<T>(database: Datastore | undefined, datas: any): Promise<T> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
    //
    let canPending = !PendingDatasUnloadDb.hasBeenSyncedDb(database);

    const data = await new Promise<T>((resolve, reject) => {
      database.insert(datas, this.promiseResolve(resolve, reject));
    });

    canPending &&
      PendingDatasUnloadDb.putDataPending('insertOrUpdate', database, data);

    return data;
  },

  async remove<T>(
    database: Datastore | undefined,
    query = {},
    options: Datastore.RemoveOptions = {}
  ): Promise<T> {
    if (!database) return Promise.reject(null);
    loadDatabase(database);
    //
    let canPending = !PendingDatasUnloadDb.hasBeenSyncedDb(database);
    if (canPending) {
      this.findOne<T>(database, query).then((data) => {
        data && PendingDatasUnloadDb.putDataPending('remove', database, data);
      });
    }

    return await new Promise<T>((resolve, reject) => {
      database.remove(query, options, this.promiseResolve(resolve, reject));
    });
  },
  async update(
    database: Datastore | undefined,
    query: any,
    updateQuery: any,
    options?: Datastore.UpdateOptions | undefined
  ): Promise<{ numAffected: number }> {
    if (!database) return Promise.reject(null);

    loadDatabase(database);

    let canPending = !PendingDatasUnloadDb.hasBeenSyncedDb(database);

    const updated = await new Promise<{ numAffected: number }>(
      (resolve, reject) => {
        database.update(
          query,
          updateQuery,
          options || {},
          (err, numAffected) => {
            if (err) {
              reject(err);
            } else {
              resolve({ numAffected });
            }
          }
        );
      }
    );

    if (canPending) {
      this.findOne(database, query).then((data) => {
        data &&
          PendingDatasUnloadDb.putDataPending('insertOrUpdate', database, data);
      });
    }

    return updated;
  },
};

export default db;
