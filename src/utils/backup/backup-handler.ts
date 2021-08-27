import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { mainWindow } from '../../sys';
import { IPC_EVENTS } from '../ipc-events';
const doWhilst = require('async/doWhilst') as typeof import('async').doWhilst;
const whilst = require('async/whilst') as typeof import('async').whilst;
// import fs from 'fs';

type FolderTree = {
  fileFolder: null | { name: string; id: string };
  parentFoler: null | { name: string; id: string };
};

type fileMeta = { name: string; id: string; parents: string[] | undefined };

class DriveHandler {
  private static oAuth2Client?: OAuth2Client;

  private static driveInstance?: drive_v3.Drive;

  protected static STORAGE_SPACE: string = 'appDataFolder';

  private static filesIds = {} as { [name: string]: string | undefined };

  private static idFileMeta = {} as {
    [id: string]: fileMeta | undefined;
  };

  public static setFileMeta(id: string, value: fileMeta) {
    this.idFileMeta[id] = value;
  }

  public static getFileMeta(id: string) {
    return this.idFileMeta[id];
  }

  public static setFileId(name: string, id: string) {
    this.filesIds[name] = id;
  }

  public static getFileId(name: string) {
    return this.filesIds[name];
  }

  public static setOAuth2Client(oAuth2Client: OAuth2Client) {
    this.oAuth2Client = oAuth2Client;
  }

  public static drive() {
    if (!this.oAuth2Client) {
      throw new Error('oAuth2Client property cannot be null');
    }
    if (!this.driveInstance) {
      this.driveInstance = google.drive({
        version: 'v3',
        auth: this.oAuth2Client,
      });
    }
    return this.driveInstance;
  }

  public static async files(params: drive_v3.Params$Resource$Files$List = {}) {
    const drive = this.drive();
    const files = await drive.files.list({
      ...params,
      spaces: this.STORAGE_SPACE,
    });
    return files;
  }

  public static fileFolderTree(file: drive_v3.Schema$File) {
    const drive = this.drive();
    this.setFileId(file.name as string, file.id as string);
    this.setFileMeta(file.id as string, {
      id: file.id as string,
      name: file.name as string,
      parents: file.parents,
    });

    return new Promise<null | FolderTree>((resolve) => {
      if (!file.parents || file.parents.length === 0) return resolve(null);
      let countParent = 0;
      let parents = file.parents;
      const tree: FolderTree = {
        fileFolder: null,
        parentFoler: null,
      };

      const getTree = async (next: Function) => {
        const parent = (parents as string[])[0];
        const meta = this.getFileMeta(parent);
        const newFile = meta
          ? meta
          : (
              await drive.files.get({
                fileId: parent,
                fields: 'id, name, parents',
              })
            ).data;

        const data = {
          id: newFile.id as string,
          name: newFile.name as string,
        };

        if (!meta) {
          this.setFileMeta(parent, { ...data, parents: newFile.parents });
        }

        if (!tree.fileFolder) {
          tree.fileFolder = data;
        } else if (!tree.parentFoler) {
          tree.parentFoler = data;
        }
        countParent += 1;
        parents = newFile.parents as string[];
        next();
      };

      whilst(
        () =>
          countParent < 2 &&
          (tree.fileFolder === null || tree.parentFoler === null) &&
          parents.length > 0,
        (next) => {
          try {
            getTree(next);
          } catch (_) {}
        },
        (_err) => resolve(_err ? null : tree)
      );
    });
  }
}

export class BackupHandler extends DriveHandler {}

export class RestoreHanlder extends DriveHandler {
  static async handle() {
    let nextToken: undefined | string = undefined;

    const fetchFiles = async (
      next: (err?: Error | null | undefined, ...results: unknown[]) => void
    ) => {
      try {
        const res = await this.files({
          q: "mimeType='text/plain' and name contains '.db'",
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
      (err) => console.log('Error on fetched files restore', err)
    );
  }

  static proceedFiles(files: drive_v3.Schema$File[]) {
    const newFiles = files.slice();
    return new Promise<any>((resolve) => {
      const proceed = async (next: Function) => {
        const file = newFiles.shift();
        this.commitBackupProgress(newFiles.length, files.length);
        if (file) await this.restoreFile(file);
        next();
      };
      whilst(
        () => newFiles.length !== 0,
        (next) => proceed(next),
        (_err) => resolve(_err)
      );
    });
  }

  static async restoreFile(file: drive_v3.Schema$File) {
    const folderTree = await this.fileFolderTree(file);
    if (!folderTree) return;
  }

  static commitBackupProgress(proceed: number, total: number) {
    if (mainWindow) {
      mainWindow.webContents.send(
        IPC_EVENTS.backup_progression,
        proceed,
        total
      );
    }
  }
}
