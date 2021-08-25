import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { shell } from 'electron';
import webServer, { TmpServer } from './webserver';
import { promisify } from 'util';
import { loggedIn } from './response-html';
import https from 'https';
import { getAssetCredentialsPath } from '../../sys';

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];

const TOKEN_PATH = getAssetCredentialsPath('google-client-token.json');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
async function authorize(credentials: any): Promise<OAuth2Client | null> {
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
    oAuth2Client = await getAccessToken(oAuth2Client, server);
  }

  server.server.close();

  return oAuth2Client;
}

/**
 * the toute from express js server to be han
 * @param server
 * @returns
 */
async function redirectedRoute(server: TmpServer): Promise<string | null> {
  return new Promise((resolve) => {
    server.app.get('/', (_req, res) => {
      res.send(loggedIn);
      if (_req.query.code) {
        resolve(_req.query.code.toString());
      } else {
        resolve(null);
      }
    });
  });
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
    const code = await redirectedRoute(server);
    return code ? await storeClientToken(oAuth2Client, code) : null;
  } catch (error) {
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

export default async function googleOAuth2(): Promise<OAuth2Client | null> {
  try {
    const content = await readFile(
      getAssetCredentialsPath('google-drive-credentials.json')
    );
    return await authorize(JSON.parse(content.toString('utf-8')));
  } catch (error) {
    console.log('Error loading client secret file:', error);
  }
  return null;
}

export function getUserInfo(
  access_token: string
): Promise<{ [x: string]: string; email: string } | null> {
  const options = {
    hostname: 'https://www.googleapis.com',
    path: '/oauth2/v3/userinfo',
    method: 'GET',
    port: 443,
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
  };

  return new Promise((resolve) => {
    https
      .get(options, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          resolve(JSON.parse(data));
        });
      })
      .on('error', (_err) => {
        console.log(_err);
        resolve(null);
      });
  });
}
