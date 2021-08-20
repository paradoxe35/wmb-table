import { getAssetDbPath, getAssetDocumentsDbPath } from '../../sys';
import { debounce, getFilename } from '../functions';
import { countFileLines, readRangeLinesInFile } from '../main/count-file-lines';
import { EventEmitter } from 'events';
import Datastore from 'nedb';
import db, { queryDb } from '../main/db';
import { BackupDbReference } from '../../types';

const watch = require('node-watch');

const eventEmiter = new EventEmitter({ captureRejections: true });
const loadedDbEventName = 'loadedDb';
const dbFilesExludedRegx = /(configurations|backup\-db\-references)\.db/;

export const loadedDb = {
  dbs: [] as string[],
  dbFiles: {} as { [x: string]: string },
  syncedRefsDb: [] as string[],
  loadDb(database: Datastore<any> & { filename?: string }) {
    const filename = getFilename(database.filename as string);
    if (dbFilesExludedRegx.test(filename) || this.dbs.includes(filename))
      return;
    this.dbs.push(filename);
    this.dbFiles[filename] = database.filename as string;
    eventEmiter.emit(loadedDbEventName, filename);
  },
};

eventEmiter.on(loadedDbEventName, (filenameEvent) => {
  eventEmiter.on(filenameEvent, debounce(performUniqueBackup, 2000));
});

/**
 * get saved file meta references
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
 * save file meta when line change
 *
 * @param filename
 * @param lines
 * @returns
 */
const syncDbLinesAsBackupRef = async (
  filename: string,
  lines?: number
): Promise<number> => {
  const ref = await getDbReference(filename);
  const fileLines = lines || (await countFileLines(loadedDb.dbFiles[filename]));
  if (ref) {
    await queryDb.update(
      db.backupDbReferences,
      { _id: ref._id },
      { $set: { lines: fileLines } }
    );
  } else {
    await queryDb.insert(db.backupDbReferences, { filename, lines: fileLines });
  }
  return fileLines;
};

type RangedLines = {
  [id: string]: { deleted: boolean; _id: string; data?: any };
};
/**
 * range to grounped data with action
 *
 * @param range ;
 * @returns
 */
const groupChangedLinesByAction = (range: string[]) => {
  return range.reduce((acc, current) => {
    try {
      const json = JSON.parse(current) as { [n: string]: any; _id: string };
      const keys = Object.keys(json);
      const deleted = keys.includes('$$deleted');
      acc[json._id] = {
        _id: json._id,
        deleted: deleted,
        data: deleted ? {} : json,
      };
    } catch (_) {}
    return acc;
  }, {} as RangedLines);
};

/**
 * form update just specifique changed file db
 *
 * @param filename
 * @returns
 */
const performUniqueBackup = async (filename: string) => {
  const ref = await getDbReference(filename);
  if (!ref) return;
  const rangeLines = await readRangeLinesInFile(
    loadedDb.dbFiles[filename],
    +ref.lines
  );
  if (rangeLines.length === 0) return;
  const grouped = groupChangedLinesByAction(rangeLines);
  // handle backup on network (google drive or any other drive) or save somewhere as pending backup
  // code ...

  // after backup performence, sync file db reference
  // syncDbLinesAsBackupRef(filename, +ref.lines + rangeLines.length);
  console.log(grouped);
};

/**
 * saved files state when file db loaded
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
    return false;
  }
  return true;
};

/**
 * the top level function to perform wached changed files
 *
 * @param evt
 * @param name
 * @returns
 */
const performBackup = async (evt: string, name: string) => {
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
 * filter function on watch changed files
 *
 * @param file
 * @param skip
 * @returns
 */
const filterWatchedFiles = function (file: string, skip: any) {
  if (dbFilesExludedRegx.test(file)) return skip;
  return /\.db$/.test(file);
};

export default () => {
  watch(getAssetDocumentsDbPath(), { filter: filterWatchedFiles }).on(
    'change',
    performBackup
  );
  watch(getAssetDbPath(), { filter: filterWatchedFiles }).on(
    'change',
    performBackup
  );
};
