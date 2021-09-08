import path from 'path';
import { app, BrowserWindow } from 'electron';

export const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../assets');

export function childsProcessesPath(): string {
  return __dirname + '/childs_processes';
}

export let mainWindow: BrowserWindow | null = null;

export const setMainWindow = (mWindow: BrowserWindow) => (mainWindow = mWindow);

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
  return getAssetPath('credentials', ...paths);
};
