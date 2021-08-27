import { mainWindow } from '../../sys';
import { RestoreProgressEvent, RestoreProgressEventType } from '../../types';
import { IPC_EVENTS } from '../ipc-events';

export let DATA_RESTORED: boolean | null = false;
export let DATA_RESTORING: boolean = false;

export const setDataRestored = (value: boolean | null) =>
  (DATA_RESTORED = value);

export const setDataRestoring = (value: boolean) => (DATA_RESTORING = value);

// exluded files regex
export const excludedDbFilesRegex = /(configurations|backup.*)\.db$/;

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
