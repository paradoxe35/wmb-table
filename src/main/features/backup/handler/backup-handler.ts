import { DriveHandler } from './drive-handler';
import fs from 'fs';
import { getAssetBackupPendingPath, getAssetDocumentsPath } from '@root/sys';
import { commitRestoreProgress, setDataBackingUpPending } from '../constants';
import { asyncify, whilst } from '@main/functions/async';
import { camelCase, getFilename } from '@root/utils/functions';
import db, { DBSerializer, getDatastoreFileName, queryDb } from '@main/db/db';
import Datastore from '@seald-io/nedb';
import { CustomDocument, PendingDatastore } from '@localtypes/index';
import { DB_EXTENSION } from '@root/utils/constants';
import { Readable } from 'stream';
import { drive_v3 } from 'googleapis';
import { promisify } from 'util';
import { deletePending } from '../backup';

export class BackupHandler extends DriveHandler {
  static async handlePending(options: { notify: boolean } = { notify: true }) {
    const dir = getAssetBackupPendingPath();
    if (!fs.existsSync(dir)) return;
    const readdir = promisify(fs.readdir);

    const files = (await readdir(dir)).filter((file) =>
      file.endsWith(DB_EXTENSION)
    );

    setDataBackingUpPending(true);

    options.notify && commitRestoreProgress('sauvegarde', 0, files.length);

    return new Promise<void>((resolve, reject) => {
      const newFiles = files.slice();

      const proceed = async () => {
        const filename = getFilename(newFiles.shift() as string);

        const fileDb = camelCase(filename.split(DB_EXTENSION)[0]);
        const datastore = db[fileDb];

        const pendingDb = this.pendingDatastore(filename);
        const pendings = await queryDb.find<PendingDatastore>(pendingDb);

        for (const pending of pendings) {
          const data = await queryDb.findOne<any>(datastore, {
            _id: pending.dbId,
          });
          if (!data && !pending.deleted) {
            return await deletePending(pendingDb, pending.dbId, true);
          }
          await this.handleUpload(
            pending.dbId,
            !!pending.deleted,
            data,
            filename
          );
          await deletePending(pendingDb, pending.dbId);
        }

        options.notify &&
          commitRestoreProgress(
            'sauvegarde',
            files.length - newFiles.length,
            files.length
          );
      };

      whilst(
        asyncify(() => newFiles.length !== 0),
        asyncify(proceed),
        (_err: any) => {
          if (_err) {
            reject(_err);
            options.notify && commitRestoreProgress('error', 0, 0);
          } else {
            resolve();
            options.notify && commitRestoreProgress(this.COMPLETE, 0, 0);
          }
          setDataBackingUpPending(false);
        }
      );
    });
  }

  static pendingDatastore(filename: string) {
    const db = new Datastore<PendingDatastore>({
      filename: getAssetBackupPendingPath(filename),
    });
    db.loadDatabase();
    return db;
  }

  static async getFromDriveId(
    fieldName: string,
    q: string
  ): Promise<string | undefined> {
    const fileId = this.getFileId(fieldName);
    if (fileId) return fileId;
    const { data } = await this.files({
      q,
      fields: 'files(id)',
      pageSize: 1,
    });
    if (!data.files || data.files.length === 0) return undefined;
    const id = data.files[0].id as string;
    this.setFileId(fieldName, id);
    return id;
  }

  static async getDriveFileId(
    name: string,
    fieldName: string,
    parentId: string
  ) {
    return await this.getFromDriveId(
      fieldName,
      `name = '${name + this.MAIN_FILE_EXTENSION}' and '${parentId}' in parents`
    );
  }

  static get spacesToParent() {
    return this.STORAGE_SPACE !== 'drive' ? [this.STORAGE_SPACE] : undefined;
  }

  static async getDriveFolderId(name: string): Promise<string> {
    let id = await this.getFromDriveId(
      name,
      `name = '${name}' and mimeType = '${this.FOLDER_MIME_TYPE}'`
    );
    if (id) return id;
    const drive = this.drive();

    const { data } = await drive.files.create({
      fields: 'id',
      requestBody: {
        name,
        parents: this.spacesToParent,
        mimeType: this.FOLDER_MIME_TYPE,
      },
    });

    id = data.id as string;
    this.setFileId(name, id);

    return data.id as string;
  }

  static async handleUpload(
    dataId: string,
    deleted: boolean,
    dataJson: any,
    filename: string
  ) {
    const folderName = getFilename(filename).split(DB_EXTENSION)[0];
    const drive = this.drive();

    const folderId = await this.getDriveFolderId(folderName);
    const fieldName = dataId + folderName;

    const fileId = await this.getDriveFileId(dataId, fieldName, folderId);

    if (deleted && fileId) {
      await drive.files.delete({
        fileId: fileId,
      });
      if (getDatastoreFileName(db.customDocuments) === filename) {
        await this.deleteCustomDocument(dataId);
      }
      return;
    }

    const body:
      | drive_v3.Params$Resource$Files$Update
      | drive_v3.Params$Resource$Files$Create = {
      requestBody: {
        mimeType: this.MAIN_FILE_MIME_TYPE,
        name: dataId + this.MAIN_FILE_EXTENSION,
      },
      fields: 'id',
      media: {
        mimeType: this.MAIN_FILE_MIME_TYPE,
        body: Readable.from([DBSerializer.serialize(dataJson)]),
      },
    };

    // if exist update otherwise create new files
    if (fileId) {
      await drive.files.update({
        fileId: fileId,
        ...body,
      });
    } else {
      const res = await drive.files.create({
        ...body,
        requestBody: {
          ...body.requestBody,
          parents: [folderId],
        },
      });

      this.setFileId(fieldName, res.data.id as string);

      if (getDatastoreFileName(db.customDocuments) === filename) {
        await this.storeCustomDocument(dataJson);
      }
    }
  }

  static async storeCustomDocument(data: CustomDocument) {
    const filepath = getAssetDocumentsPath(`${data.title}.html`);
    if (!fs.existsSync(filepath)) return;

    const filename = `${data._id}.html`;

    const drive = await this.drive();

    const res = await drive.files.create({
      requestBody: {
        mimeType: 'text/html',
        name: filename,
        parents: this.spacesToParent,
      },
      fields: 'id',
      media: {
        mimeType: 'text/html',
        body: fs.createReadStream(filepath),
      },
    });

    this.setFileId(filename, res.data.id as string);
  }

  static async deleteCustomDocument(id: string) {
    const filename = `${id}.html`;
    const fileId = await this.getFromDriveId(filename, `name = '${filename}'`);
    if (fileId) {
      const drive = this.drive();
      await drive.files.delete({
        fileId: fileId,
      });
    }
  }
}