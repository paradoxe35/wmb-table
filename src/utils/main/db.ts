import Datastore from 'nedb';
import {
  getAssetBackupPath,
  getAssetBiblePath,
  getAssetDbPath,
  getAssetDocumentsDbPath,
} from '../../sys';
import { loadedDb } from '../backup/backup';

interface Db {
  configurations?: Datastore | undefined;
  history?: Datastore | undefined;
  historyItem?: Datastore | undefined;
  documents?: Datastore | undefined;
  documentsTitle?: Datastore | undefined;
  subjects?: Datastore | undefined;
  sidebarStatus?: Datastore | undefined;
  subjectItems?: Datastore | undefined;
  tabs?: Datastore | undefined;
  suggestions?: Datastore | undefined;
  customDocuments?: Datastore | undefined;

  notes?: Datastore | undefined;
  notesReference?: Datastore | undefined;
  notesBibleReference?: Datastore | undefined;
  bible?: Datastore | undefined;

  backupDbReferences?: Datastore | undefined;
}

const db: Db = {};
const databases: Datastore<any>[] = [];

export const loadDatabase = function (database: Datastore<any> | undefined) {
  if (database && !databases.includes(database)) {
    database.loadDatabase();
    databases.push(database);
    loadedDb.loadDb(database);
  }
};

const dbStore = (name: string) =>
  new Datastore({
    filename: getAssetDbPath(`${name}.db`),
    autoload: false,
    timestampData: true,
  });

db.documents = new Datastore({
  filename: getAssetDocumentsDbPath(`documents.db`),
  autoload: false,
});

db.documentsTitle = new Datastore({
  filename: getAssetDocumentsDbPath(`documents-title.db`),
  autoload: false,
});

db.bible = new Datastore({
  filename: getAssetBiblePath(`bible.db`),
  autoload: false,
});

db.backupDbReferences = new Datastore({
  filename: getAssetBackupPath(`backup-db-references.db`),
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
