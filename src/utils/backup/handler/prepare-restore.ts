import { getAssetBackupPendingPath, getAssetDbPath } from '../../../sys';
import { asyncify, whilst } from '../../async';
import Datastore from 'nedb';
import { camelCase, getFilename } from '../../functions';
import db, { getDatastoreFileName, queryDb } from '../../main/db';
import { commitRestoreProgress, EXCLUDE_DB_FILES_REGEX } from '../constants';
import { CustomDocument, PendingDatastore } from '../../../types';
import { DB_EXTENSION } from '../../constants';
import fs from 'fs';
import { promisify } from 'util';

export class PrepareRestore {
  static async handle() {
    commitRestoreProgress('prepare', 0, 0);

    const readdir = promisify(fs.readdir);

    const files = await readdir(getAssetDbPath());

    return new Promise<void>((resolve, reject) => {
      const newFiles = files.slice();

      const proceed = async () => {
        const filename = getFilename(newFiles.shift() as string);
        if (
          EXCLUDE_DB_FILES_REGEX.test(filename) ||
          !filename.endsWith(DB_EXTENSION)
        )
          return;

        const fileDb = camelCase(filename.split(DB_EXTENSION)[0]);
        const datastore = db[fileDb];
        if (datastore) await this.pendingData(datastore, filename);
      };

      whilst(
        asyncify(() => newFiles.length !== 0),
        asyncify(proceed),
        (_err) => {
          if (_err) {
            reject(_err);
            commitRestoreProgress('error', 0, 0);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static pendingDatastore(filename: string) {
    return new Datastore<PendingDatastore>({
      filename: getAssetBackupPendingPath(filename),
      autoload: true,
    });
  }

  static async pendingData(datastore: Datastore, filename: string) {
    const ids = await queryDb.find<{ _id: string }>(datastore, {}, { _id: 1 });

    const pendingDb = this.pendingDatastore(filename);

    await queryDb.insert<PendingDatastore>(
      pendingDb,
      ids.map((id) => ({ dbId: id._id }))
    );

    if (getDatastoreFileName(db.customDocuments) === filename) {
      await this.pendingDataCustomDocument(datastore);
    }
  }

  static async pendingDataCustomDocument(datastore: Datastore) {
    const docs = await queryDb.find<CustomDocument>(datastore);

    await this.pendingDocuments(docs);
    await this.pendingDocumentsTitle(docs);
  }

  static async pendingDocuments(docs: CustomDocument[]) {
    const documentsDb = this.pendingDatastore(
      getDatastoreFileName(db.documents) as string
    );

    for (const doc of docs) {
      const document = await queryDb.findOne<{ _id: string }>(
        db.documents,
        { title: doc.title },
        { _id: 1 }
      );
      if (document) {
        await queryDb.insert<PendingDatastore>(documentsDb, {
          dbId: document._id,
        });
      }
    }
  }

  static async pendingDocumentsTitle(docs: CustomDocument[]) {
    const documentsTitleDb = this.pendingDatastore(
      getDatastoreFileName(db.documentsTitle) as string
    );

    for (const doc of docs) {
      const docTitle = await queryDb.findOne<{ _id: string }>(
        db.documentsTitle,
        { title: doc.title },
        { _id: 1 }
      );
      if (docTitle) {
        await queryDb.insert<PendingDatastore>(documentsTitleDb, {
          dbId: docTitle._id,
        });
      }
    }
  }
}
