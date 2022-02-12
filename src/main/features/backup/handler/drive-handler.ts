import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';

export type ParentFolder = {
  name: string;
  id: string;
  parents: string[] | undefined;
};

export class DriveHandler {
  private static oAuth2Client?: OAuth2Client;

  private static driveInstance?: drive_v3.Drive;

  protected static STORAGE_SPACE: 'drive' | 'appDataFolder' | 'photos' =
    'appDataFolder';

  protected static FOLDER_MIME_TYPE: 'application/vnd.google-apps.folder' =
    'application/vnd.google-apps.folder';

  protected static MAIN_FILE_EXTENSION: '.json' = '.json';

  protected static MAIN_FILE_MIME_TYPE: 'application/json' = 'application/json';

  private static filesIds = {} as { [name: string]: string | undefined };

  /**
   * Complete key, used as key event after restoration
   * @property
   */
  protected static COMPLETE: 'complete' = 'complete';

  private static parentFolders = {} as {
    [id: string]: ParentFolder | undefined;
  };

  /**
   * set parent folder of file id in memory
   *
   * @param id
   * @param value
   */
  public static setParentFolder(id: string, value: ParentFolder) {
    this.parentFolders[id] = value;
  }

  /**
   * get parent folder of file id from memory
   *
   * @param id
   * @returns
   */
  public static getParentFolder(id: string) {
    return this.parentFolders[id];
  }

  /**
   * set filename with drive id in memory
   *
   * @param name
   * @param id
   */
  public static setFileId(name: string, id: string) {
    this.filesIds[name] = id;
  }

  /**
   * get file id from memory
   *
   * @param name
   * @returns
   */
  public static getFileId(name: string) {
    return this.filesIds[name];
  }

  /**
   * set auth client instance
   *
   * @param oAuth2Client
   */
  public static setOAuth2Client(oAuth2Client: OAuth2Client) {
    this.oAuth2Client = oAuth2Client;
  }

  /**
   * drive method, used to perform query actions
   * it use singleton pattern
   *
   * @returns
   */
  public static drive() {
    if (!this.oAuth2Client) {
      throw new Error('oAuth2Client property cannot be null');
    }
    if (!this.driveInstance) {
      this.driveInstance = google.drive({
        version: 'v3',
        // @ts-ignore
        auth: this.oAuth2Client,
        timeout: 1000 * 30,
        retry: true,
      });
    }
    return this.driveInstance;
  }

  /**
   * custom Query method by fetch all file even trashed files
   *
   * @param params
   * @param withTrashed
   * @returns
   */
  public static async files(
    params: drive_v3.Params$Resource$Files$List = {},
    withTrashed: boolean = false
  ) {
    const drive = this.drive();
    if (params.q && !withTrashed) {
      params.q += ' and trashed = false';
    }
    const files = await drive.files.list({
      ...params,
      spaces: this.STORAGE_SPACE,
    });
    return files;
  }

  /**
   * Get drive file by file id
   *
   * @param fileId
   * @returns
   */
  public static async getFileById(
    fileId: string
  ): Promise<drive_v3.Schema$File | null> {
    const drive = this.drive();

    const { data } = await drive.files.get({
      fileId,
      fields: 'id, name, parents',
    });

    return data || null;
  }

  /**
   * return parent folder of file
   *
   * @param file
   * @returns
   */
  public static async parentFolder(file: drive_v3.Schema$File) {
    const drive = this.drive();

    const parentId = file.parents ? file.parents[0] : undefined;
    if (!parentId) return null;

    let parentFolder = this.getParentFolder(parentId);
    if (parentFolder) return parentFolder;

    const { data } = await drive.files.get({
      fileId: parentId,
      fields: 'id, name, parents',
    });

    if (!data) return null;

    parentFolder = {
      id: data.id!,
      name: data.name!,
      parents: data.parents,
    };

    this.setParentFolder(parentId, parentFolder);

    return parentFolder;
  }
}
