import path from 'path';
import fs from 'fs';
import { app, BrowserWindow } from 'electron';
import { APP_NAME } from './utils/constants';

export const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../assets');

export let mainWindow: BrowserWindow | null = null;

export const setMainWindow = (mWindow: BrowserWindow) => (mainWindow = mWindow);

// app paths
export function childsProcessesPath(file: string): string {
  return __dirname + '/main/childs_processes/' + file;
}

export const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

export const getAssetDatasPath = (...paths: string[]): string => {
  return getAssetPath('datas', ...paths);
};

export const getAssetDocumentsDbPath = (...paths: string[]): string => {
  return getAssetPath('datas/documents-db', ...paths);
};

export const getAssetBiblePath = (...paths: string[]): string => {
  return getAssetPath('datas/bible', ...paths);
};

export const getAssetBackupPath = (...paths: string[]): string => {
  return getAssetPath('datas/backup', ...paths);
};

export const getAssetBackupPendingPath = (...paths: string[]): string => {
  return getAssetPath('datas/backup/pending', ...paths);
};

export const getAssetDbPath = (...paths: string[]): string => {
  return getAssetPath('datas/db', ...paths);
};

export const getAssetDocumentsPath = (...paths: string[]): string => {
  return getAssetPath('datas/documents', ...paths);
};

export const getAssetCredentialsPath = (...paths: string[]): string => {
  return getAssetPath('datas/credentials', ...paths);
};

// get image path

export function getImagesPath(relativePath: string) {
  if (app.isPackaged === false) {
    return path.join(__dirname, relativePath);
  } else {
    let asarUnpackedPath = __dirname.replace(
      /\.asar([\\/])/,
      '.asar.unpacked$1'
    );
    return path.join(asarUnpackedPath, relativePath);
  }
}

export function getAppHomePath(...paths: string[]) {
  const appName = APP_NAME.toLowerCase().split(' ').join('-');
  const homePath = path.join(app.getPath('home'), `.${appName}`, ...paths);
  if (!fs.existsSync(homePath)) {
    fs.mkdirSync(homePath, { recursive: true });
  }

  return homePath;
}
