import { drive_v3 } from 'googleapis';
import {
  getAssetBackupPath,
  getAssetDocumentsPath,
  mainWindow,
} from '../../../sys';
import { camelCase } from '../../functions';
import { IPC_EVENTS } from '../../ipc-events';
import db, { getDatastoreFileName, queryDb } from '../../main/db';
import Datastore from 'nedb';
import { CustomDocument } from '../../../types';
import { Stream } from 'stream';
import { checkForFile } from '../../main/count-file-lines';
import fsPromises from 'fs/promises';
import fs from 'fs';
import { confirmRestoration } from '../../../message-control/handlers/backup';
import { DriveHandler, ParentFolder } from './drive-handler';

const doWhilst = require('async/doWhilst') as typeof import('async').doWhilst;
const whilst = require('async/whilst') as typeof import('async').whilst;

export class RestoreHanlder extends DriveHandler {
  private static progress: number = 0;

  private static lastProceedFile: string | null = null;

  private static PATH_PROCCED_FILE: string = getAssetBackupPath(
    'proceed-file.json'
  );

  private static continueRestore: boolean = false;

  static async handle() {
    this.commitBackupProgress('start', 0, 0);

    let nextToken: undefined | string = undefined;

    this.lastProceedFile = await this.getLastProceedFile();
    if (this.lastProceedFile === 'complete') return;

    const fetchFiles = async (
      next: (err?: Error | null | undefined, ...results: unknown[]) => void
    ) => {
      try {
        const res = await this.files({
          q: "mimeType='application/json'",
          fields: 'nextPageToken, files(id, name, parents)',
          pageSize: 100,
          pageToken: nextToken,
        });
        nextToken = res.data.nextPageToken;
        const files = res.data.files;

        if (files) await this.proceedFiles(files);

        next(null, nextToken);
      } catch (error) {
        next(error);
      }
    };

    doWhilst<any>(
      (next) => fetchFiles(next),
      () => !!nextToken,
      (err) => {
        if (err) {
          this.commitBackupProgress('error', 0, 0);
          console.log('Error on fetched files restore', err);
        } else {
          this.commitBackupProgress('complete', 0, 0);
          this.makeProceedFile('complete');
          confirmRestoration();
        }
      }
    );
  }

  private static async makeProceedFile(id: string | null) {
    await fsPromises.writeFile(
      this.PATH_PROCCED_FILE,
      JSON.stringify({ proceedFile: id })
    );
  }

  private static async getLastProceedFile() {
    if (!fs.existsSync(this.PATH_PROCCED_FILE)) return null;
    const data = await fsPromises.readFile(this.PATH_PROCCED_FILE, {
      encoding: 'utf-8',
    });
    try {
      const json = JSON.parse(data.toString()) as { proceedFile: string };
      return json.proceedFile;
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  private static proceedFiles(files: drive_v3.Schema$File[]) {
    return new Promise<any>((resolve) => {
      const newFiles = files.slice();

      const proceed = async (next: Function) => {
        const file = newFiles.shift();
        // this condition will check the last file id proceed with error or where the loop beacked
        if (
          this.lastProceedFile !== null &&
          this.lastProceedFile !== file?.id &&
          this.continueRestore === false
        ) {
          return next();
        }

        this.continueRestore = true;

        this.commitBackupProgress(
          'progress-' + this.progress++,
          newFiles.length,
          files.length
        );
        if (file) {
          await this.restoreFile(file);
          await this.makeProceedFile(file.id || null);
        }
        next();
      };
      whilst(
        () => newFiles.length !== 0,
        (next) => proceed(next),
        (_err) => resolve(_err)
      );
    });
  }

  private static async restoreFile(file: drive_v3.Schema$File) {
    const parentFile = await this.parentFolder(file);
    if (!parentFile) return;
    const datastore = db[camelCase(parentFile.name)];
    if (datastore) await this.storeContent(datastore, file, parentFile);
  }

  private static async storeContent(
    database: Datastore,
    file: drive_v3.Schema$File,
    parentFile: ParentFolder
  ) {
    const drive = await this.drive();
    try {
      const { data } = await drive.files.get(
        {
          fileId: file.id,
          alt: 'media',
        },
        { responseType: 'json' }
      );
      await queryDb.insert(database, data);
      // handle custom document restaure
      if (getDatastoreFileName(db.customDocuments) === parentFile.name) {
        await this.handleCustomDocument(data as any);
      }
    } catch (error) {
      console.error('Error parsing exported file from drive: ', error);
    }
  }

  private static async handleCustomDocument(data: CustomDocument) {
    const filename = `${data.title}.html`;
    const drive = this.drive();
    try {
      const {
        data: { files },
      } = await this.files({
        q: `name = '${filename}'`,
        pageSize: 1,
      });
      if (files && files.length > 0) {
        const file = files[0];
        const { data } = await drive.files.get(
          {
            fileId: file.id,
            alt: 'media',
          },
          { responseType: 'stream' }
        );
        await this.saveDocumentHtml(data as Stream, filename);
      }
    } catch (error) {
      console.error(
        'Error fetching html file from on custom document restoration: ',
        error
      );
    }
  }

  private static saveDocumentHtml(data: Stream, filename: string) {
    const filePath = getAssetDocumentsPath(filename);
    return new Promise<void>((resolve) => {
      checkForFile(filePath, (filePath) => {
        data.pipe(fs.createWriteStream(filePath)).on('end', resolve);
      });
    });
  }

  private static commitBackupProgress(
    type: string,
    proceed: number,
    total: number
  ) {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_EVENTS.backup_progression, {
        type,
        data: {
          proceed,
          total,
        },
      });
    }
  }
}
