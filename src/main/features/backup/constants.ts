import {
  RestoreProgressEvent,
  RestoreProgressEventType,
} from '@localtypes/index';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { OAuth2Client } from 'google-auth-library';
import { DB_EXTENSION } from '@root/utils/constants';
import { sendIpcToRenderer } from '@root/ipc/ipc-main';

type Value<T = boolean | null> = { value: T };

export const DATA_RESTORED: Value<boolean> = {
  value: false,
};

export const DATA_RESTORING: Value<boolean> = {
  value: false,
};

export const DATA_BACKINGUP_PENDING: Value = {
  value: false,
};

export const PERFORM_BACKINGUP_PENDING_DATA: Value = {
  value: false,
};

export const OAUTH2_CLIENT: { value: OAuth2Client | null } = {
  value: null,
};

export const RESTORE_COMPLETED_EVENT = 'restore-completed';

export const setDataRestored = (value: boolean) =>
  (DATA_RESTORED.value = value);

export const setDataRestoring = (value: boolean) =>
  (DATA_RESTORING.value = value);

export const setDataBackingUpPending = (value: boolean) =>
  (DATA_BACKINGUP_PENDING.value = value);

export const setPerfomBackingUpPendingData = (value: boolean) =>
  (PERFORM_BACKINGUP_PENDING_DATA.value = value);

export const setOAuth2Client = (client: OAuth2Client | null) =>
  (OAUTH2_CLIENT.value = client);

export const EXCLUDE_DB_FILES_REGEX = new RegExp(
  `(configurations|sidebar\\-status|tabs|backup.*|audio.*)\\${DB_EXTENSION}$`
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
  sendIpcToRenderer(IPC_EVENTS.backup_progression, <RestoreProgressEvent>{
    type,
    progression: {
      proceed,
      total,
    },
  });
}
