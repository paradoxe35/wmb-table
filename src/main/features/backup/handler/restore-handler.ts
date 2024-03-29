import { drive_v3 } from 'googleapis';
import { getAssetBackupPath, getAssetDocumentsPath } from '@root/sys';
import { camelCase } from '@root/utils/functions';
import db, { DBSerializer, getDatastoreFileName, queryDb } from '@main/db/db';
import Datastore from '@seald-io/nedb';
import { BackupActions, CustomDocument } from '@localtypes/index';
import { Stream } from 'stream';
import { checkForFile } from '@main/functions/count-file-lines';
import fs from 'fs';
import { confirmRestoration } from '@main/message-control/handlers/backup';
import { DriveHandler, ParentFolder } from './drive-handler';
import {
  commitRestoreProgress,
  EXCLUDE_DB_FILES_REGEX,
  setDataRestoring,
} from '../constants';
import { asyncify, doWhilst, whilst } from '@main/functions/async';
import { promisify } from 'util';
import log from 'electron-log';

export class RestoreHandler extends DriveHandler {
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
  private static PATH_PROCEED_FILE: string = getAssetBackupPath(
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
    commitRestoreProgress('start', 0, 0);

    this.lastProceedFile = await this.getLastProceedFile();
    if (this.lastProceedFile === this.COMPLETE) return;

    return new Promise<void>((resolve, reject) => {
      const nextToken: { value: undefined | string } = { value: undefined };
      setDataRestoring(true);

      // callback function to doWhilst for handling files
      const fetchFiles = async () => {
        const res = await this.files({
          q: `mimeType='${this.MAIN_FILE_MIME_TYPE}'`,
          fields: 'nextPageToken, files(id, name, parents)',
          pageSize: 100,
          pageToken: nextToken.value,
          orderBy: 'modifiedTime',
        });
        nextToken.value = res.data.nextPageToken;
        const files = res.data.files;
        this.progress++;

        if (files) await this.proceedFiles(files);
      };

      // async function to run all required files for restoration
      doWhilst<any>(
        asyncify(fetchFiles),
        asyncify(() => !!nextToken.value),
        (err: any) => {
          if (err) {
            commitRestoreProgress('error', 0, 0);
            log.error('Error on fetched files restore', err.name, err.message);
            reject(err);
          } else {
            this.makeProceedFile(this.COMPLETE);
            setTimeout(() => {
              commitRestoreProgress(this.COMPLETE, 0, 0);
              confirmRestoration(true);
              resolve();
            }, 3100);
          }
          setDataRestoring(false);
        }
      );
    });
  }

  /**
   * store the latest proceed file, used to begin from if the the last restore fails
   * @param id file id
   */
  private static async makeProceedFile(id: string | null) {
    const writeFile = promisify(fs.writeFile);
    await writeFile(
      this.PATH_PROCEED_FILE,
      JSON.stringify({ proceedFile: id })
    );
  }

  /**
   * get the latest proceed file
   */
  private static async getLastProceedFile(): Promise<string | null> {
    if (!fs.existsSync(this.PATH_PROCEED_FILE)) return null;
    const readFile = promisify(fs.readFile);
    const data = await readFile(this.PATH_PROCEED_FILE, {
      encoding: 'utf-8',
    });
    try {
      const json = JSON.parse(data.toString()) as { proceedFile: string };
      return json.proceedFile;
    } catch (error) {
      log.error('getLastProceedFile error: ', error?.message);
    }
    return null;
  }

  /**
   * proceed files for restoration
   * @param files
   */
  private static proceedFiles(files: drive_v3.Schema$File[]) {
    return new Promise<any>((resolve, reject) => {
      const newFiles = files.slice();

      commitRestoreProgress(`progress-${this.progress}`, 0, files.length);

      const proceed = async () => {
        const file = newFiles.shift();
        // this condition will check the last file id proceed with error or where the loop beacked
        if (
          this.lastProceedFile !== null &&
          this.lastProceedFile !== file?.id &&
          this.continueRestore === false
        ) {
          return;
        }

        this.continueRestore = true;
        commitRestoreProgress(
          `progress-${this.progress}`,
          files.length - newFiles.length,
          files.length
        );
        if (file) {
          await this.restoreFile(file);
          await this.makeProceedFile(file.id || null);
        }
      };

      // top level function to proceed files
      whilst(
        asyncify(() => newFiles.length !== 0),
        asyncify(proceed),
        (_err: any) => (_err ? reject(_err) : resolve(null))
      );
    });
  }

  /**
   * proceed individual file for restortion
   * @param file proceed file
   */
  public static async restoreFile(
    file: drive_v3.Schema$File,
    action: BackupActions = 'create'
  ) {
    const parentFile = await this.parentFolder(file);
    if (!parentFile || EXCLUDE_DB_FILES_REGEX.test(parentFile.name)) return;

    const datastore = db[camelCase(parentFile.name)];
    if (datastore) await this.storeContent(datastore, file, parentFile, action);
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
    parentFile: ParentFolder,
    action: BackupActions
  ) {
    const drive = this.drive();
    const { data } = await drive.files.get(
      {
        fileId: file.id,
        alt: 'media',
      },
      { responseType: 'text' }
    );

    let $datas = null;

    try {
      $datas = DBSerializer.deserialize(data as string);
    } catch (error) {
      log.warn('deserialize error', error?.message || error);
    }

    if (!data || !$datas || !$datas._id) return;

    switch (action) {
      case 'create':
        await queryDb.insert(database, { ...$datas });
        break;
      case 'update':
        const ndatas = { ...$datas };
        delete ndatas._id;
        await queryDb.update(database, { _id: $datas._id }, { $set: ndatas });
        break;
      default:
        break;
    }

    // handle custom document restaure
    if (getDatastoreFileName(db.customDocuments, false) === parentFile.name) {
      await this.handleCustomDocument($datas, action);
    }
  }

  /**
   * handle save related datas on custom document datastore
   * @param data
   */
  private static async handleCustomDocument(
    data: CustomDocument,
    action: BackupActions
  ) {
    try {
      const {
        data: { files },
      } = await this.files({
        q: `name = '${data?._id}.html'`,
        pageSize: 1,
      });

      if (files && files.length > 0) {
        const file = files[0];
        switch (action) {
          case 'create':
            await this.createDocumentHtml(file, data);
            break;

          default:
            break;
        }
      }
    } catch (error) {
      log.error(
        'Error fetching html file from on custom document restoration: ',
        error?.message || error
      );
    }
  }

  /**
   * Get the writable stream from google drive and process save of file
   *
   * @param file
   * @param data
   */
  private static async createDocumentHtml(
    file: drive_v3.Schema$File,
    data: CustomDocument
  ) {
    const drive = this.drive();
    const { data: fileData } = await drive.files.get(
      {
        fileId: file.id,
        alt: 'media',
      },
      { responseType: 'stream' }
    );
    await this.saveDocumentHtml(fileData as Stream, `${data.title}.html`);
  }

  /**
   * save file html form custom document handler
   * @param data data from drive as stream
   * @param filename filename document
   */
  private static saveDocumentHtml(data: Stream, filename: string) {
    const filePath = getAssetDocumentsPath(filename);
    if (fs.existsSync(filename)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      checkForFile(filePath, (filePath) => {
        data
          .pipe(fs.createWriteStream(filePath))
          .on('finish', resolve)
          .on('error', reject);
      });
    });
  }
}
