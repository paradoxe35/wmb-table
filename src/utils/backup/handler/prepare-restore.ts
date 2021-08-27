import fs from 'fs/promises';
import { getAssetBackupPendingPath, getAssetDbPath } from '../../../sys';
import { asyncify, whilst } from '../../async';
import Datastore from 'nedb';
import { camelCase, getFilename } from '../../functions';
import db, { getDatastoreFileName, queryDb } from '../../main/db';
import { commitRestoreProgress, excludedDbFilesRegex } from '../constants';
import { CustomDocument, PeddingDatastore } from '../../../types';

export class PrepareRestore {
  static async handle() {
    commitRestoreProgress('prepare', 0, 0);

    const files = await fs.readdir(getAssetDbPath());

    return await new Promise<void>((resolve, reject) => {
      const newFiles = files.slice();

      const proceed = async (next: Function) => {
        const file = getFilename(newFiles.shift() as string);
        if (excludedDbFilesRegex.test(file)) return next();

        try {
          const fileDb = camelCase(file.split('.db')[0]);
          const datastore = db[fileDb];
          if (datastore) await this.pendingData(datastore, file);
          next();
        } catch (error) {
          next(error);
        }
      };

      whilst(
        asyncify(() => newFiles.length !== 0),
        (next) => proceed(next),
        (_err) => (_err ? reject(_err) : resolve())
      );
    });
  }

  static pendingDatastore(filename: string) {
    return new Datastore({
      filename: getAssetBackupPendingPath(filename),
      autoload: true,
    });
  }

  static async pendingData(datastore: Datastore, filename: string) {
    const ids = await queryDb.find<{ _id: string }>(datastore, {}, { _id: 1 });

    const pendingDb = this.pendingDatastore(filename);

    await queryDb.insert<PeddingDatastore>(
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
        await queryDb.insert<PeddingDatastore>(documentsDb, {
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
        await queryDb.insert<PeddingDatastore>(documentsTitleDb, {
          dbId: docTitle._id,
        });
      }
    }
  }
}
