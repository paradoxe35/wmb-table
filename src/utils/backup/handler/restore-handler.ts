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
import {
  CustomDocument,
  RestoreProgressEvent,
  RestoreProgressEventType,
} from '../../../types';
import { Stream } from 'stream';
import { checkForFile } from '../../main/count-file-lines';
import fsPromises from 'fs/promises';
import fs from 'fs';
import { confirmRestoration } from '../../../message-control/handlers/backup';
import { DriveHandler, ParentFolder } from './drive-handler';

const doWhilst = require('async/doWhilst') as typeof import('async').doWhilst;
const whilst = require('async/whilst') as typeof import('async').whilst;
const asyncify = require('async/asyncify') as typeof import('async').asyncify;

export class RestoreHanlder extends DriveHandler {
  /**
   * restoration progression
   * @property
   */
  private static progress: number = 0;

  /**
   * if not null, used as start point file for restoration
   * @property
   */
  private static lastProceedFile: string | null = null;

  /**
   * filepath where to save the latest proceed file
   * @property
   */
  private static PATH_PROCCED_FILE: string = getAssetBackupPath(
    'proceed-file.json'
  );

  /**
   * if @property lastProceedFile is not null, then used mark restore continue
   * @property
   */
  private static continueRestore: boolean = false;

  /**
   * Top level method to start restoration
   */
  static async handle() {
    this.commitBackupProgress('start', 0, 0);

    let nextToken: undefined | string = undefined;

    this.lastProceedFile = await this.getLastProceedFile();
    if (this.lastProceedFile === 'complete') return;

    // callback function to doWhilst for handling files
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

    // async function to run all required files for restoration
    doWhilst<any>(
      (next) => fetchFiles(next),
      asyncify(() => !!nextToken),
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

  /**
   * store the latest proceed file, used to begin from if the the last restore fails
   * @param id file id
   */
  private static async makeProceedFile(id: string | null) {
    await fsPromises.writeFile(
      this.PATH_PROCCED_FILE,
      JSON.stringify({ proceedFile: id })
    );
  }

  /**
   * get the latest proceed file
   */
  private static async getLastProceedFile(): Promise<string | null> {
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

  /**
   * proceed files for restoration
   * @param files
   */
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
        this.progress++;
        this.commitBackupProgress(
          `progress-${this.progress}`,
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
        asyncify(() => newFiles.length !== 0),
        (next) => proceed(next),
        (_err) => resolve(_err)
      );
    });
  }

  /**
   * proceed individual file for restortion
   * @param file proceed file
   */
  private static async restoreFile(file: drive_v3.Schema$File) {
    const parentFile = await this.parentFolder(file);
    if (!parentFile) return;
    const datastore = db[camelCase(parentFile.name)];
    if (datastore) await this.storeContent(datastore, file, parentFile);
  }

  /**
   * handle file save as data in datastore
   * @param database assotiated nedb datastore used for query insertion of file data as json
   * @param file file data or consider as column data on datastore
   * @param parentFile represented as folder or database table contains column filez
   */
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

  /**
   * handle save related datas on custom document datastore
   * @param data
   */
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

  /**
   * save file html form custom document handler
   * @param data data from drive as stream
   * @param filename filename document
   */
  private static saveDocumentHtml(data: Stream, filename: string) {
    const filePath = getAssetDocumentsPath(filename);
    return new Promise<void>((resolve) => {
      checkForFile(filePath, (filePath) => {
        data.pipe(fs.createWriteStream(filePath)).on('end', resolve);
      });
    });
  }

  /**
   * @param type type of event commition
   * @param proceed proceed files length
   * @param total total of files
   */
  private static commitBackupProgress(
    type: RestoreProgressEventType,
    proceed: number,
    total: number
  ) {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_EVENTS.backup_progression, {
        type,
        progression: {
          proceed,
          total,
        },
      } as RestoreProgressEvent);
    }
  }
}
