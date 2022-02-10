import type { BackedUp } from '../backup/handler/backup-handler.d';
import { BACKUP_EVENT_EMITER } from '../backup/handler/backup-handler';
import { app_settings } from '@main/message-control/handlers/app_settings';
import { backup_status } from '@main/message-control/handlers/backup';
import { SynchronizerAppInstanceDatastore } from './datastores';
import { BackupStatus, AppSettingsStatus } from '@localtypes/index';
import { initializeFireorm } from './utils';
import { setFirestoreInstance } from './constants';
import {
  AppInstance,
  AppInstanceRepository,
  DataRepository,
} from './collections';
import { CustomIsOnlineEmitter } from '../is-online-emitter';
import isOnline from 'is-online';

const isOnlineEmitter = new CustomIsOnlineEmitter();

const CAN_SYNC = {
  value: false,
  pending_process: <(() => any)[]>[],
};

const APP_INSTANCE: { value: AppInstance | undefined } = {
  value: undefined,
};

/**
 * use to clear all unsubscription functions
 */
const unsubscribes = <(() => any)[]>[];

/**
 * listene whether the connectivity has changed then process all pending callbacks
 */
isOnlineEmitter.connectivity_change((status) => {
  if (status.online) {
    CAN_SYNC.pending_process.forEach(() => {
      const process = CAN_SYNC.pending_process.shift();
      process && process();
    });
  }
});

/**
 * Process the upload synchronization
 *
 * @param data
 */
function backedup_handler(data: BackedUp) {}

/**
 * Capture uploaded data from another app instance firestore
 *
 * @param snapshot
 */
function snapshoted_data_handler(
  snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
) {}

/**
 * Capture all error form firestore snapshot events
 *
 * @param error
 */
function snapshoted_data_error(error: Error) {}

/**
 * Initiliaze app instance if not yet, and if user has no internet connection then save the process as pending
 *
 * @param backupStatus
 * @param appSetting
 * @returns
 */
async function init_app_instance(
  backupStatus: BackupStatus,
  appSetting: AppSettingsStatus
) {
  // check if whether user has interent connection, if has not internet
  // then push then the actual function in pending callback
  if (!(await isOnline())) {
    CAN_SYNC.pending_process.push(() =>
      init_app_instance(backupStatus, appSetting)
    );
  }
  // App instance datastore
  const appInstanceDatastore = new SynchronizerAppInstanceDatastore();
  let appInstance = await appInstanceDatastore.data();
  if (!appInstance) {
    const appInstanceRep = new AppInstanceRepository();
    appInstance = await appInstanceRep.create({
      drive_account_email: backupStatus.email,
      app_id: appSetting.app_id,
      data_cursor_count: 1,
    });

    APP_INSTANCE.value = appInstance;

    CAN_SYNC.value = true;

    appInstanceDatastore.create(appInstance);
  }

  return appInstance;
}

/**
 * Top level function to start synchronizer process
 */
async function start() {
  // firstly check synchronizer can start process, by check app status exists and backup status exists too
  // get app status exists
  const appSetting = await app_settings();
  // get backup status exists
  const backupStatus = await backup_status(true);
  // check backup status exists and if the restoration process has been done
  if (!appSetting || !backupStatus || !backupStatus.restored) {
    return;
  }

  // initialize fireorm form firebase admin
  const firestore = initializeFireorm();

  setFirestoreInstance(firestore);

  // init app instance if not exist
  await init_app_instance(backupStatus, appSetting);

  // ---------- Upload and download performer -------------

  // start listening of backup event, then process the synchronization updaload process
  BACKUP_EVENT_EMITER.on('backup', backedup_handler);

  // listener to data snapshot, then perform the download process
  const dataRepository = new DataRepository();
  dataRepository.onSnapshot(
    backupStatus.email,
    snapshoted_data_handler,
    snapshoted_data_error
  );
}

/**
 * close synchronizer method, by cleaning event etc.
 */
function close() {
  // clean backup event lister
  BACKUP_EVENT_EMITER.off('backup', backedup_handler);
  // stop online emitter
  isOnlineEmitter.stop();

  // clean all unsubscribes
  unsubscribes.forEach(() => {
    const unsubscribe = unsubscribes.shift();
    unsubscribe && unsubscribe();
  });
}

export default {
  start,
  close,
};
