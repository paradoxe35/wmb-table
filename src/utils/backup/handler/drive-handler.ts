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

  protected static STORAGE_SPACE: string = 'appDataFolder';

  private static filesIds = {} as { [name: string]: string | undefined };

  private static parentFolders = {} as {
    [id: string]: ParentFolder | undefined;
  };

  public static setParentFolder(id: string, value: ParentFolder) {
    this.parentFolders[id] = value;
  }

  public static getParentFolder(id: string) {
    return this.parentFolders[id];
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

    parentFolder = {
      id: data.id as string,
      name: data.name as string,
      parents: data.parents,
    };

    this.setParentFolder(parentId, parentFolder);

    return parentFolder;
  }
}
