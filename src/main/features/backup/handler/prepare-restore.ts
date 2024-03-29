import { getAssetBackupPendingPath, getAssetDbPath } from '@root/sys';
import { asyncify, whilst } from '@main/functions/async';
import Datastore from '@seald-io/nedb';
import { camelCase, getFilename } from '@root/utils/functions';
import db, { getDatastoreFileName, queryDb } from '@main/db/db';
import { commitRestoreProgress, EXCLUDE_DB_FILES_REGEX } from '../constants';
import { CustomDocument, PendingDatastore } from '@localtypes/index';
import { DB_EXTENSION } from '@root/utils/constants';
import fs from 'fs';
import { promisify } from 'util';

export class PrepareRestore {
  /**
   * Top level method to start restore preparation
   * @returns
   */
  static async handle() {
    commitRestoreProgress('prepare', 0, 0);

    const readdir = promisify(fs.readdir);

    const files = await readdir(getAssetDbPath());

    return new Promise<void>((resolve, reject) => {
      const newFiles = files.slice();

      const proceed = async () => {
        const filename = getFilename(newFiles.shift()!);
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
        (_err: any) => {
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

  /**
   * Get Pending Datastore db instance by passing db filename
   *
   * @param filename
   * @returns
   */
  private static pendingDatastore(filename: string) {
    const db = new Datastore<PendingDatastore>({
      filename: getAssetBackupPendingPath(filename),
    });
    db.loadDatabase();
    return db;
  }

  /**
   * Store data as pending
   *
   * @param datastore
   * @param filename
   */
  private static async pendingData(datastore: Datastore, filename: string) {
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

  /**
   * Store custom document as pending
   *
   * @param datastore
   */
  private static async pendingDataCustomDocument(datastore: Datastore) {
    const docs = await queryDb.find<CustomDocument>(datastore);

    await this.pendingDocumentsTitle(docs);
  }

  /**
   * Feaching titles in titels's db from custom document db and store them as pending
   *
   * @param docs
   */
  private static async pendingDocumentsTitle(docs: CustomDocument[]) {
    const documentsTitleDb = this.pendingDatastore(
      getDatastoreFileName(db.documentsTitle)!
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
