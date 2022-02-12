import type { BackedUp } from '../backup/handler/backup-handler.d';
import { BACKUP_EVENT_EMITER } from '../backup/handler/backup-handler';
import { app_settings } from '@main/message-control/handlers/app_settings';
import { backup_status } from '@main/message-control/handlers/backup';
import {
  PendingBackedUpDatastore,
  SynchronizerAppInstanceDatastore,
} from './datastores';
import { BackupStatus, AppSettingsStatus } from '@localtypes/index';
import { initializeFireorm, UniqueLoopProcess } from './utils';
import { setFirestoreInstance } from './constants';
import {
  AppInstance,
  AppInstanceRepository,
  Data,
  DataRepository,
} from './collections';
import { CustomIsOnlineEmitter } from '../is-online-emitter';
import log from 'electron-log';
import { DriveHandler } from '../backup/handler/drive-handler';
import { RestoreHandler } from '../backup/handler/restore-handler';
import { sendIpcToRenderer } from '@root/ipc/ipc-main';
import { IPC_EVENTS } from '@root/utils/ipc-events';

const isOnlineEmitter = new CustomIsOnlineEmitter();

/**
 * Use to run unique process loop every 3 seconds
 */
const loopProcess = new UniqueLoopProcess(3000);

const CAN_SYNC = {
  value: false,
  pending_process: <(() => any)[]>[],
};

const APP_INSTANCE: { value: AppInstance | undefined } = {
  value: undefined,
};

const PROCESSING_BACKEDUP_DATA = {
  value: false,
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
 * throw error if user hasnt internet connection
 */
async function require_connectivity() {
  if (!(await isOnlineEmitter.isOnlineFetch())) {
    throw new Error('connectivity is required to process the suite');
  }
}

/**
 * Update the actuel app instance data cursor
 *
 * @param add
 */
async function update_appinstance_data_cursor(add: number = 1) {
  const appInstance = APP_INSTANCE.value!;
  const appInstanceRep = new AppInstanceRepository();

  // commit the update data cursor
  const nappInstance = await appInstanceRep.update_data_cursor(
    appInstance.id,
    add
  );

  // set the fresh updated app instance
  APP_INSTANCE.value = nappInstance;

  return nappInstance;
}

/**
 * Download the data
 *
 * @param data
 */
async function download_unsynchronized_data(data: Data) {
  const appInstance = APP_INSTANCE.value!;

  // here to determine how incrementation the app instance should increment the its data cursor
  let new_cursor = data.cursor_counter - appInstance.data_cursor_count;
  new_cursor = new_cursor < 1 ? 1 : new_cursor;

  // connectivity checking
  await require_connectivity();

  // first get file shema from drive
  const driveFile = await DriveHandler.getFileById(data.file_drive_id);

  // if file hasnt been found then update the appinstance cursor data and cancel the process
  if (!driveFile) {
    await update_appinstance_data_cursor(new_cursor);
    return;
  }

  /**
   * restore File and update the appinstance cursor data
   */
  await RestoreHandler.restoreFile(driveFile);
  await update_appinstance_data_cursor(new_cursor);

  /**
   * Notify the view or renderer electron process about the new synchronization
   */
  sendIpcToRenderer(IPC_EVENTS.new_synchronized_datas);
}

/**
 * Process all datas which are not yet synchronized
 * And Return the latest data synchronized
 */
async function process_unsynchronized_datas(): Promise<void> {
  const dataRepository = new DataRepository();

  /**
   * Perform recursivily the process of download the unsynchronized datas
   */
  const perform_process = async (): Promise<void> => {
    const appInstance = APP_INSTANCE.value!;

    // connectivity checking
    await require_connectivity();

    /**
     * Get unsynchronized data from data repository
     */
    const unsynchronized_datas = await dataRepository.getUnsynchronizedData(
      appInstance
    );

    // If unsynchronized_datas var is empty then stop the recursive process
    if (!unsynchronized_datas || unsynchronized_datas.length === 0) {
      return;
    }

    // log unsynchronized_datas variable when in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '--------- unsynchronized_datas -------',
        unsynchronized_datas
      );
    }

    // go througth all on unsynchronized_datas
    for (const data of unsynchronized_datas) {
      await download_unsynchronized_data(data);
    }

    return await perform_process();
  };

  return await perform_process();
}

/**
 *
 * @param ldata the keep increment from last data cursor count
 */
async function process_uploading_pendings_datas() {
  let appInstance = APP_INSTANCE.value!;

  // get all pending backedup datas and upload them
  const pendingDatastore = new PendingBackedUpDatastore();
  const pending_datas = await pendingDatastore.datas();

  // data repository
  const dataRepository = new DataRepository();

  // connectivity checking
  await require_connectivity();

  for (const data of pending_datas) {
    // create data repository of new changes app processs
    const ndata = await dataRepository.create({
      action: data.action,
      file_drive_id: data.file_drive_id,
      drive_account_email: appInstance.drive_account_email,
      app_instance_id: appInstance.id,
    });

    // get the fresh update of app instance
    appInstance = APP_INSTANCE.value!;

    // here to determine how incrementation the app instance should increment the its data cursor
    let new_cursor = ndata.cursor_counter - appInstance.data_cursor_count;
    new_cursor = new_cursor < 0 ? 0 : new_cursor;
    // update app instance data cursor
    await update_appinstance_data_cursor(new_cursor);
  }
}

/**
 * Process the upload synchronization
 *
 * @param data
 */
async function backedup_handler(data: BackedUp) {
  const pendingDatasDatastore = new PendingBackedUpDatastore();

  /**
   * Always store the backedup app in pendings, to be process later
   */
  pendingDatasDatastore.create(data);

  // if no internet or can sync has false value then store backedup data as pending
  if (!CAN_SYNC.value || !(await isOnlineEmitter.isOnlineFetch())) {
    return;
  }

  PROCESSING_BACKEDUP_DATA.value = true;

  try {
    /**
     * Before saving the backedup data to firestore,
     * firstly check and process if there are some datas which are not yet synchronized
     */
    await process_unsynchronized_datas();
    // After finish processing unsynchronized_datas then start upload the pendings datas
    await process_uploading_pendings_datas();
  } catch (error) {
    log.error(error);
    log.error('fail to process backedup data: ', error.message);
  }

  PROCESSING_BACKEDUP_DATA.value = false;
}

async function loop_on_unsynchronized_datas() {}

/**
 * Capture uploaded data from another app instance firestore and process download of document
 *
 * @param snapshot
 */
// function snapshoted_data_handler(
//   snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
// ) {}

/**
 * Capture all error form firestore snapshot events
 *
 * @param error
 */
// function snapshoted_data_error(error: Error) {
//   log.error('snapshoted_data_error: ', error.message);
//   log.error('snapshoted_data_error error instance: ', error);
// }

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
  if (!(await isOnlineEmitter.isOnlineFetch())) {
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
  } else {
    APP_INSTANCE.value = appInstance;
    CAN_SYNC.value = true;
  }

  return appInstance;
}

/**
 * Top level function to start synchronizer process
 * This function must be perfom only when user use drive backup feature
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

  /**
   * Run a loop to check out every defined time if there are unsynchronized datas
   */
  loopProcess.loop(loop_on_unsynchronized_datas);

  // ---------------------- in case we listen for data firestore snapshot ------------------

  // listener to data snapshot, then perform the download process
  // const dataRepository = new DataRepository();
  // const unsubscription = dataRepository.onSnapshot(
  //   backupStatus.email,
  //   snapshoted_data_handler,
  //   snapshoted_data_error
  // );

  // push unsubscription function in unsubscribes for a late clean up
  // unsubscription && unsubscribes.push(unsubscription);

  // ---------------------- in case we listen for data firestore snapshot ------------------
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

  // close the unique loop process
  loopProcess.stop();
}

export default {
  start,
  close,
};
