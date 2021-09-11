import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { shell } from 'electron';
import { promisify } from 'util';
import { childsProcessesPath, getAssetCredentialsPath } from '../../sys';
import { setOAuth2Client } from './constants';
import childProcess, { ChildProcess } from 'child_process';
import { APP_NAME } from '../constants';
import { ChildProcessMessage } from '../../childs_processes/types';
import { cancellablePromise } from '../functions';
import { setUserAuthAccessStatus } from '../../message-control/handlers/backup';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];

const TOKEN_PATH = getAssetCredentialsPath('google-client-token.json');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize(
  credentials: any,
  login: boolean = false,
  overwriteClientToken: boolean = false
): Promise<OAuth2Client | null> {
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  // start webserver from child process

  process.env.CHLD_APP_NAME = APP_NAME;
  process.env.CHLD_WEBSITE_LINK = process.env.WEBSITE_LINK;

  const child = childProcess.fork(childsProcessesPath('loggedin.js'), {
    env: process.env,
  });

  // wait port information from child process server
  const port = await new Promise<number>((resolve) => {
    child.once('message', (message: ChildProcessMessage<number>) => {
      if (message.type === 'port') {
        resolve(message.data);
      } else {
        resolve(0);
      }
    });
  });

  let oAuth2Client: OAuth2Client | null = new google.auth.OAuth2(
    client_id,
    client_secret,
    `${redirect_uris[1]}:${port}`
  );

  const access = async (oAuth2Client: OAuth2Client | null) =>
    login && oAuth2Client ? await getAccessToken(oAuth2Client, child) : null;

  let oneAccess: boolean = false;

  try {
    if (!overwriteClientToken) {
      const token = await readFile(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token.toString('utf-8')));
    } else {
      oneAccess = true;
      oAuth2Client = await access(oAuth2Client);
    }
  } catch (error) {
    if (!oneAccess && !overwriteClientToken) {
      oAuth2Client = await access(oAuth2Client);
    }
  }

  child.kill('SIGINT');

  return oAuth2Client;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken(oAuth2Client: OAuth2Client, child: ChildProcess) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  shell.openExternal(authUrl);
  let timer: NodeJS.Timeout | null = null;

  try {
    const requestForCodePromise = new Promise<string | null>((resolve) => {
      child.once('message', (message: ChildProcessMessage<string | null>) => {
        message.type === 'code' && resolve(message.data);
        message.type !== 'code' && resolve(null);
      });
    });

    // make the promise cancellable
    const requestForCode = cancellablePromise(requestForCodePromise);

    timer = setTimeout(() => {
      if (requestForCode.reject) {
        requestForCode.reject('TIMEOUT');
      }
    }, 3 * 60000);

    // now wait for response
    const code = await requestForCode;

    // remove timeout timer
    timer && clearTimeout(timer);

    return code ? await storeClientToken(oAuth2Client, code) : null;
  } catch (error) {
    console.log('signin error: ', error?.message || error);
    timer && clearTimeout(timer);
    return null;
  }
}

function checkHasAllPermission(token: any): boolean {
  if (!token.scope) return true;
  const ntoken: { scope: string | string[] } = token;
  let scopes: string[] = [];

  if (typeof ntoken.scope === 'string') {
    scopes = ntoken.scope.split(' ').map((d: string) => d.trim());
  } else if (Array.isArray(ntoken.scope)) {
    scopes = ntoken.scope.map((d: string) => d.trim());
  } else {
    return true;
  }

  let has = true;
  SCOPES.forEach((permission) => {
    if (!scopes.includes(permission)) {
      has = false;
    }
  });

  setUserAuthAccessStatus(has);

  return has;
}

/**
 * after client has been logged in, store the refresh token associedted
 *
 * @param oAuth2Client
 * @param code
 */
function storeClientToken(
  oAuth2Client: OAuth2Client,
  code: string
): Promise<OAuth2Client | null> {
  return new Promise((resolve) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err || !token) {
        resolve(null);
        return console.error('Error retrieving access token', err);
      }

      checkHasAllPermission({ ...token });

      oAuth2Client.setCredentials(token as any);
      // Store the token to disk for later program executions
      writeFile(TOKEN_PATH, JSON.stringify(token))
        .then(() => resolve(oAuth2Client))
        .catch((err) => {
          resolve(null);
          console.error(err);
        });
    });
  });
}

export default async function googleOAuth2(
  login: boolean = false,
  overwriteClientToken: boolean = false
): Promise<OAuth2Client | null> {
  try {
    const content = await readFile(
      getAssetCredentialsPath('google-drive-credentials.json')
    );
    const client = await authorize(
      JSON.parse(content.toString('utf-8')),
      login,
      overwriteClientToken
    );
    setOAuth2Client(client);
    return client;
  } catch (error) {
    console.log('Error loading client secret file:', error?.message || error);
  }
  return null;
}

export async function getUserInfo(oAuth2Client: OAuth2Client) {
  const auth = google.oauth2({
    auth: oAuth2Client,
    version: 'v2',
  });
  const userInfo = await auth.userinfo.get();
  return userInfo.data;
}
