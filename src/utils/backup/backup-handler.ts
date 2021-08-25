import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
// import fs from 'fs';
import { APP_NAME } from '../constants';

class DriveHandler {
  protected static oAuth2Client: OAuth2Client | null = null;

  protected static readonly STORAGE_PATH: string = APP_NAME.split(' ')
    .map((e) => e.toLowerCase())
    .join('-');

  public static setOAuth2Client(oAuth2Client: OAuth2Client) {
    this.oAuth2Client = oAuth2Client;
  }

  public static drive() {
    if (!this.oAuth2Client) {
      throw new Error('oAuth2Client property cannot be null');
    }
    return google.drive({
      version: 'v3',
      auth: this.oAuth2Client,
    });
  }

  public static async files() {
    const drive = this.drive();
    const files = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${this.STORAGE_PATH}'`,
    });
    return files.data.files;
  }
}

export class BackupHandler extends DriveHandler {}

export class RestaureHanlder extends DriveHandler {
  static async handle() {
    const drive = this.files();

    // for (const dir of WATCHED_DIRS) {
    //   const folder = getFilename(dir);
    // }
  }

  static restaureDbDates() {}
}
