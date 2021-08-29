import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { shell } from 'electron';
import webServer, { TmpServer } from './webserver';
import { promisify } from 'util';
import { loggedIn } from './response-html';
import { getAssetCredentialsPath } from '../../sys';
import { setOAuth2Client } from './constants';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  // 'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive',
];

const TOKEN_PATH = getAssetCredentialsPath('google-client-token.json');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
export let lastCode: string | null = null;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize(
  credentials: any,
  login: boolean = false
): Promise<OAuth2Client | null> {
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const server = await webServer();

  let oAuth2Client: OAuth2Client | null = new google.auth.OAuth2(
    client_id,
    client_secret,
    `${redirect_uris[1]}:${server.port}`
  );

  try {
    const token = await readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token.toString('utf-8')));
  } catch (error) {
    oAuth2Client = login ? await getAccessToken(oAuth2Client, server) : null;
  }

  server.server.close();

  return oAuth2Client;
}

/**
 * the toute from express js server to be han
 * @param server
 * @returns
 */
async function redirectRoute(server: TmpServer): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    server.server.on('close', resolve);
    server.app.get('/', (_req, res) => {
      res.send(loggedIn);

      if (_req.query.code) {
        const code = _req.query.code.toString();
        lastCode = code;
        resolve(code);
      } else {
        reject(null);
      }
    });
  });
}

/**
 *
 * @param promise
 * @returns
 */
function cancellablePromise<T>(promise: Promise<T>) {
  let _resolve, _reject;

  let wrap: Promise<T> & {
    resolve?: (value: T) => void;
    reject?: (value: T) => void;
  } = new Promise<any>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
    promise.then(resolve).catch(reject);
  });
  wrap.resolve = _resolve;
  wrap.reject = _reject;

  return wrap;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken(oAuth2Client: OAuth2Client, server: TmpServer) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  shell.openExternal(authUrl);

  try {
    const requestForCode = cancellablePromise(redirectRoute(server));

    setTimeout(() => {
      if (requestForCode.reject) {
        requestForCode.reject('TIMEOUT');
      }
    }, 3 * 60000);

    const code = await requestForCode;
    return code ? await storeClientToken(oAuth2Client, code) : null;
  } catch (error) {
    console.log('signin error: ', error?.message || error);
    return null;
  }
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
      if (err) {
        resolve(null);
        return console.error('Error retrieving access token', err);
      }
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
  login: boolean = false
): Promise<OAuth2Client | null> {
  try {
    const content = await readFile(
      getAssetCredentialsPath('google-drive-credentials.json')
    );
    const client = await authorize(
      JSON.parse(content.toString('utf-8')),
      login
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
