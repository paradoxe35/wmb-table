import {
  getAssetBackupPendingPath,
  getAssetDbPath,
  getAssetDocumentsDbPath,
} from '@root/sys';
import log from 'electron-log';
import { debounce, getFilename } from '@root/utils/functions';
import {
  countFileLines,
  readRangeLinesInFile,
} from '@main/functions/count-file-lines';
import { EventEmitter } from 'events';
import Datastore from '@seald-io/nedb';
import db, { DBSerializer, getDatastoreFileName, queryDb } from '@main/db/db';
import {
  BackupDbReference,
  BackupStatus,
  PendingDatastore,
} from '@localtypes/index';
import { BackupHandler } from './handler/backup-handler';
import { RestoreHandler } from './handler/restore-handler';
import googleOAuth2 from './googleapi';
import { DriveHandler } from './handler/drive-handler';
import {
  BACKUP_IGNORE_NEXT_ITERATION,
  DATA_BACKINGUP_PENDING,
  DATA_RESTORED,
  decrementBackupNextIteration,
  EXCLUDE_DB_FILES_REGEX,
  OAUTH2_CLIENT,
} from './constants';
import { PrepareRestore } from './handler/prepare-restore';
import { OAuth2Client } from 'google-auth-library';
import { DB_EXTENSION } from '@root/utils/constants';
import fs from 'fs';
import { setUserAuthAccessStatus } from '@main/message-control/handlers/backup';
import { UPDATER_RESTORING_DATA } from '../app-updater/constants';

import isOnline from 'is-online';
import watch from 'node-watch';

import { CustomIsOnlineEmitter } from '../is-online-emitter';

// emitter is online instance
const emitterIsOnline = new CustomIsOnlineEmitter();

// backup event emitter
const eventEmiter = new EventEmitter({ captureRejections: true });

// export backup event emitter
export { eventEmiter as backupEventEmiter };

// event name used to emit event with filename database
const LOADED_DB_EVENT_NAME = 'loadedDb';

// used as event name dispatcher to start is online stream watch network changes
export const CAN_WATCH_IS_ONLINE_EVENT = 'is-online-event-start';

// timeout to performUniqueBackup
const PERFOM_BACKUP_TIMEOUT = 3000;

// used as the actual network status
let IS_ONLINE: { value: boolean } = { value: true };

// directories to watch in
export const WATCHED_DIRS = [getAssetDocumentsDbPath(), getAssetDbPath()];

// collect unique database to be used to saved his pending datas
const pendingDb = {
  dbs: {} as { [x: string]: Datastore<PendingDatastore> },
};

export class PendingDatasUnloadDb {
  static datas: {
    [filename: string]:
      | { [id: string]: { deleted: boolean; data: any } }
      | undefined;
  } = {};

  static putDataPending(
    action: 'insertOrUpdate' | 'remove',
    database: Datastore & { filename?: string },
    data: any
  ) {
    if (
      !DATA_RESTORED.value ||
      EXCLUDE_DB_FILES_REGEX.test(database.filename!) ||
      !data
    )
      return;

    const filename = getDatastoreFileName(database)!;

    if (!this.datas[filename]) {
      this.datas[filename] = {};
    }
    (this.datas[filename] as any)[data._id] = {
      data: data,
      deleted: action === 'remove',
    };
  }

  static hasBeenSyncedDb(database: Datastore): boolean {
    const filename = getDatastoreFileName(database);
    return loadedDb.syncedRefsDb.includes(filename!) && DATA_RESTORED.value;
  }
}

/**
 * Used to collect all loaded databases that will be backuped
 * commit dbname as event, so to catch all changes that was made in dbfile and process them to backup
 */
export const loadedDb = {
  dbs: [] as string[],
  dbFilenames: {} as { [x: string]: string },
  syncedRefsDb: [] as string[],
  loadDb(database: Datastore<any> & { filename?: string }) {
    const filename = getFilename(database.filename!);
    if (
      EXCLUDE_DB_FILES_REGEX.test(database.filename!) ||
      this.dbs.includes(filename)
    )
      return;
    this.dbs.push(filename);
    this.dbFilenames[filename] = database.filename!;
    eventEmiter.emit(LOADED_DB_EVENT_NAME, filename);
  },
};

// After load database start event corresponding to database filename
eventEmiter.on(LOADED_DB_EVENT_NAME, (filenameEvent) => {
  eventEmiter.on(
    filenameEvent,
    debounce(performUniqueBackup, PERFOM_BACKUP_TIMEOUT)
  );
});

// Listening to `connectivity.change` events.
emitterIsOnline.connectivity_change(connectivityChangedHandler);

/**
 * Get saved file meta references
 *
 * @param filename
 * @returns
 */
const getDbReference = async (filename: string) => {
  return await queryDb.findOne<BackupDbReference | null>(
    db.backupDbReferences,
    {
      filename,
    }
  );
};

/**
 * Save file meta when line change
 *
 * @param filename
 * @param lines
 * @returns
 */
const syncDbLinesAsBackupRef = async (
  filename: string,
  lines?: number,
  linesToSub?: number
): Promise<number> => {
  const ref = await getDbReference(filename);
  const fileLines =
    lines || (await countFileLines(loadedDb.dbFilenames[filename]));
  if (ref) {
    await queryDb.update(
      db.backupDbReferences,
      { _id: ref._id },
      { $set: { lines: fileLines - (linesToSub || 0) } }
    );
  } else {
    await queryDb.insert(db.backupDbReferences, { filename, lines: fileLines });
  }
  return fileLines;
};

/**
 * Range to grounped data with action and merge pending data unload db
 *
 * @param range
 * @param filename
 * @returns
 */
const groupChangedLinesByAction = (range: string[], filename: string) => {
  const pendingDatas = PendingDatasUnloadDb.datas[filename];

  type DbColumn = { [n: string]: any; _id: string };

  if (pendingDatas) {
    /**
     * Get column id of ranges from range param, used to check if the pending doent have the same value
     */
    const rangeIds: string[] = range
      .map((dataStr) => {
        try {
          return JSON.parse(dataStr)._id;
        } catch (_) {}
        return null;
      })
      .filter(Boolean);

    for (const _id in pendingDatas) {
      /**
       * Push to existing range, if the actuel pending doent exist in latter range state
       */
      if (_id && !rangeIds.includes(_id)) {
        const pending = pendingDatas[_id];
        range.push(
          JSON.stringify(
            pending.deleted ? { $$deleted: true, _id } : pending.data
          )
        );
      }
    }
    PendingDatasUnloadDb.datas[filename] = undefined;
  }

  return range.reduce((acc, current) => {
    try {
      const json = DBSerializer.deserialize(current) as DbColumn;
      const keys = Object.keys(json);
      const deleted = keys.includes('$$deleted');
      acc[json._id] = {
        _id: json._id,
        deleted: deleted,
        data: deleted ? {} : json,
      };
    } catch (_) {}
    return acc;
  }, <RangedLines>{});
};
/**
 * Ranged lines type
 */
type RangedLines = {
  [id: string]: { deleted: boolean; _id: string; data?: any };
};

/**
 * Handle to put in pending data if there is other pending process or no connection network found
 *
 * @param grouped
 * @param filename
 */
async function putInPending(grouped: RangedLines, filename: string) {
  const pDb = pendingDb.dbs[filename];
  for (const key in grouped) {
    const changed = grouped[key];
    const data = {
      dbId: changed._id,
    } as PendingDatastore;

    queryDb.insert(pDb, { ...data, deleted: changed.deleted });
  }
}

/**
 * Delete pending data from pending datastore
 *
 * @param pendingDb
 * @param dbId
 * @param multi
 * @returns
 */
export const deletePending = (
  pendingDb: Datastore<any>,
  dbId: string,
  multi: boolean = false
) => queryDb.remove(pendingDb, { dbId }, { multi });

/**
 * Upload modirectly to cloud
 *
 * @param oAuth2Client
 * @param grouped
 * @param filename
 */
async function uploadModifications(
  oAuth2Client: OAuth2Client,
  grouped: RangedLines,
  filename: string
) {
  const pDb = pendingDb.dbs[filename];
  BackupHandler.setOAuth2Client(oAuth2Client);

  for (const key in grouped) {
    const changed = grouped[key];
    const data = { dbId: changed._id } as PendingDatastore;

    try {
      await BackupHandler.handleUpload(
        changed._id,
        changed.deleted,
        changed.data,
        filename
      );

      await deletePending(pDb, data.dbId, false);
    } catch (error) {
      log.error(
        'Error occured while backup data from top file changed: ',
        error?.message || error
      );
      if (!error?.code || error.code !== 404) {
        const exists = await queryDb.findOne(pDb, data);
        if (!exists) queryDb.insert(pDb, { ...data, deleted: changed.deleted });
      }
    }
  }
}

/**
 * Callback function to handle changes network status and upload pending datas if necessary
 *
 * @param onlineStatus
 */
function connectivityChangedHandler(onlineStatus: { online: boolean }): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(onlineStatus);
  }

  if (
    !IS_ONLINE.value &&
    onlineStatus.online &&
    !DATA_BACKINGUP_PENDING.value
  ) {
    IS_ONLINE.value = true;
    BackupHandler.handlePending({ notify: false });
  }
}

/**
 * Form update just specifique changed file db
 *
 * @param filename
 * @returns
 */
const performUniqueBackup = async (filename: string) => {
  /**
   * Get the last cursor db reference
   */
  const ref = await getDbReference(filename);
  if (!ref) return;
  /**
   * Get unproceed ranges line
   */
  const rangeLines = await readRangeLinesInFile(
    loadedDb.dbFilenames[filename],
    +ref.lines
  );

  /**
   * This should range line to RangedLines type and merge pending datas if exists
   */
  const grouped = groupChangedLinesByAction(rangeLines, filename);
  if (Object.keys(grouped).length === 0) return;

  /**
   * If BACKUP_IGNORE_NEXT_ITERATION has value greater than 0 then ignore the actuel backup iteratio
   */
  if (BACKUP_IGNORE_NEXT_ITERATION.value > 0) {
    syncDbLinesAsBackupRef(filename);
    decrementBackupNextIteration();
    return;
  }

  const oAuth2Client = OAUTH2_CLIENT.value || (await googleOAuth2());

  if (process.env.NODE_ENV === 'development') {
    console.log(grouped);
    console.log(
      'orginal range -- ',
      rangeLines.length,
      'Total: -- ',
      Object.keys(grouped).length,
      '\n',
      'filename: ' + filename
    );
  }

  const isOnlineStatus = await isOnline();

  IS_ONLINE.value = isOnlineStatus;

  // handle backup on network (google drive or any other drive) or save somewhere as pending backup
  if (DATA_BACKINGUP_PENDING.value || !isOnlineStatus || !oAuth2Client) {
    putInPending(grouped, filename);
  } else {
    uploadModifications(oAuth2Client, grouped, filename);
  }
  // sync file db reference
  syncDbLinesAsBackupRef(filename);
};

/**
 * Saved files state when file db loaded
 *
 * @param filename
 * @returns
 */
const syncedFirstDbReferences = async (filename: string) => {
  if (
    !loadedDb.syncedRefsDb.includes(filename) &&
    loadedDb.dbs.includes(filename)
  ) {
    await syncDbLinesAsBackupRef(filename);

    loadedDb.syncedRefsDb.push(filename);

    // init pending database per watched db
    pendingDb.dbs[filename] = new Datastore({
      filename: getAssetBackupPendingPath(filename),
      autoload: false,
    });

    const hasPending = PendingDatasUnloadDb.datas[filename];

    return hasPending && Object.keys(hasPending).length > 0;
  }
  return true;
};

/**
 * The top level function to perform wached changed files
 *
 * @param evt
 * @param name
 * @returns
 */
const performBackup = async (evt: string, name: string) => {
  // if data not yet restored or there's process updater's restore data then cancel the suite
  if (!DATA_RESTORED.value || UPDATER_RESTORING_DATA.value) {
    return;
  }

  const filename = getFilename(name);
  if (
    evt !== 'update' ||
    !loadedDb.dbs.includes(filename) ||
    !(await syncedFirstDbReferences(filename))
  ) {
    return;
  }

  eventEmiter.emit(filename, filename);
};

/**
 * Filter function on watch changed files
 *
 * @param file
 * @param skip
 * @returns
 */
const filterWatchedFiles = function (file: string, skip: any) {
  if (EXCLUDE_DB_FILES_REGEX.test(file)) return skip;
  return new RegExp(`${DB_EXTENSION}$`).test(file);
};

/**
 * The top level backup function
 */
export default () => {
  const watchers: any[] = [];

  eventEmiter.once(CAN_WATCH_IS_ONLINE_EVENT, () => {
    emitterIsOnline.start();
  });

  WATCHED_DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const watcher = watch(dir, {
      filter: filterWatchedFiles,
    });

    watcher.on('change', performBackup);
    watchers.push(watcher);
  });

  return {
    close: () => {
      emitterIsOnline.stop();
      watchers.forEach((watcher) => watcher.close());
    },
  };
};

// Functions used as top level funcs to initialize or resume backup and restoration
//--------------------------------------------------------------
async function restoreHandler(_exception: boolean = false) {
  try {
    await RestoreHandler.handle();
    await BackupHandler.handlePending();
    // If restore was succesfuly handled, then consider user have full access
    setUserAuthAccessStatus(true);
  } catch (error) {
    if (error?.code && (error.code === 403 || error.code === 401)) {
      setUserAuthAccessStatus(false);
    }
    log.error(
      'Error occured while restore data from top level function: ',
      error?.message || error
    );
  }
}

export async function initBackupAndRestoration(
  oAuth2Client: import('google-auth-library').OAuth2Client
) {
  DriveHandler.setOAuth2Client(oAuth2Client);
  try {
    await PrepareRestore.handle();
    await restoreHandler(true);
  } catch (error) {
    log.error(
      'Error occured while preapre and restore data from top level function: ',
      error?.message
    );
  }
}

export function resumeRestoration(_status: BackupStatus) {
  isOnline().then((online: boolean) => {
    if (online) {
      googleOAuth2().then((oAuth2Client) => {
        if (oAuth2Client) {
          RestoreHandler.setOAuth2Client(oAuth2Client);
          restoreHandler();
        }
      });
    }
  });
}

export function backupPenging(_status: BackupStatus) {
  isOnline().then((online: boolean) => {
    if (online) {
      googleOAuth2().then((oAuth2Client) => {
        if (oAuth2Client) {
          BackupHandler.setOAuth2Client(oAuth2Client);
          BackupHandler.handlePending({ notify: false }).catch((error) =>
            log.error('Error occured while backup pending: ', error?.message)
          );
        }
      });
    }
  });
}
