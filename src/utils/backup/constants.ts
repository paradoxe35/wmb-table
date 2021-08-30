import { mainWindow } from '../../sys';
import { RestoreProgressEvent, RestoreProgressEventType } from '../../types';
import { IPC_EVENTS } from '../ipc-events';
import { OAuth2Client } from 'google-auth-library';
import { DB_EXTENSION } from '../constants';

export let DATA_RESTORED: boolean | null = false;
export let DATA_BACKINGUP_PENDING: boolean = false;
export let OAUTH2_CLIENT: OAuth2Client | null = null;

export const setDataRestored = (value: boolean | null) =>
  (DATA_RESTORED = value);

export const setDataBackingUpPending = (value: boolean) =>
  (DATA_BACKINGUP_PENDING = value);

export const setOAuth2Client = (client: OAuth2Client | null) =>
  (OAUTH2_CLIENT = client);

export const EXCLUDE_DB_FILES_REGEX = new RegExp(
  `(configurations|sidebar\\-status|tabs|backup.*)\\${DB_EXTENSION}$`
);

/**
 * @param type type of event commition
 * @param proceed proceed files length
 * @param total total of files
 */
export function commitRestoreProgress(
  type: RestoreProgressEventType,
  proceed: number,
  total: number
) {
  if (mainWindow) {
    mainWindow.webContents.send(IPC_EVENTS.backup_progression, {
      type,
      progression: {
        proceed,
        total,
      },
    } as RestoreProgressEvent);
  }
}
