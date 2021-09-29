import path from 'path';
import { app, BrowserWindow, remote } from 'electron';

export const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath.replace(/ /g, '\\ '), 'assets')
  : path.join(__dirname, '../assets');

export let mainWindow: BrowserWindow | null = null;

export const setMainWindow = (mWindow: BrowserWindow) => (mainWindow = mWindow);

// app paths
export function childsProcessesPath(file: string): string {
  return __dirname.replace(/ /g, '\\ ') + '/childs_processes/' + file;
}

export const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
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
  if ((app || remote.app).isPackaged === false) {
    return path.join(__dirname, relativePath);
  } else {
    let asarUnpackedPath = __dirname
      .replace(/\.asar([\\/])/, '.asar.unpacked$1')
      .replace(/ /g, '\\ ');
    return path.join(asarUnpackedPath, relativePath);
  }
}
