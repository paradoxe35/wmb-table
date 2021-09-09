import { getAssetBackupPendingPath, mainWindow } from '../../sys';
import { BackupStatus } from '../../types';
import {
  backupPenging,
  initBackupAndRestoration,
  resumeRestoration,
} from '../../utils/backup/backup';
import { setDataRestored } from '../../utils/backup/constants';
import googleOAuth2, { getUserInfo } from '../../utils/backup/googleapi';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { cleanAllFileDir } from '../../utils/main/count-file-lines';
import db, { queryDb } from '../../utils/main/db';
import { app_settings } from './app_settings';
const isOnline = require('is-online');

export async function backup_status(
  onlyStatus: boolean | Object
): Promise<BackupStatus | null> {
  const status = await queryDb.findOne<BackupStatus | null>(db.backupStatus);

  if (status && status.access && typeof onlyStatus !== 'boolean') {
    setDataRestored(status.restored);
    // resume restoration or backup pending data
    !status.restored && resumeRestoration(status);
    status.restored && backupPenging(status);
  }
  return status;
}

export async function backup_reminder(): Promise<boolean> {
  let appSetting = await app_settings();
  const status = await backup_status(true);

  if (!appSetting || status) return false;

  const lastUpdate = appSetting.lastCheckBackupStatus.addDays(2);
  const now = new Date();
  if (lastUpdate >= now) return false;
  await queryDb.update(
    db.configurations,
    { _id: appSetting._id },
    { $set: { lastCheckBackupStatus: now } }
  );
  return true;
}

export async function handle_backup_login() {
  if (!(await isOnline())) {
    return { error: 'network' };
  }
  // delete all pending files backup status exists
  const status = await backup_status(true);
  if (status) {
    cleanAllFileDir(getAssetBackupPendingPath());
  }

  const googleAuth = await googleOAuth2(true, !!status);
  if (!googleAuth) {
    return { error: 'auth' };
  }
  const payload = await getUserInfo(googleAuth);

  const statusBackup: Partial<BackupStatus> = {
    email: payload.email,
    name: payload.name,
    active: true,
    access: true,
    restored: false,
    lastUpdate: new Date(),
  };

  if (status) {
    await queryDb.update(
      db.backupStatus,
      { _id: status._id },
      { $set: statusBackup }
    );
  } else {
    await queryDb.insert(db.backupStatus, statusBackup);
  }

  initBackupAndRestoration(googleAuth);

  return statusBackup;
}

export async function handle_backup_status() {
  const status = await backup_status(true);
  if (!status) return null;
  status.active = !status.active;
  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { active: status.active } }
  );
  return status;
}

export async function confirmRestoration(restored: boolean = true) {
  const status = await backup_status(true);
  if (!status) return null;

  setDataRestored(restored);
  status.restored = restored;

  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { restored } }
  );

  return status;
}

export async function setUserAuthAccessStatus(access: boolean) {
  const status = await backup_status(true);
  if (!status) return null;

  status.access = access;
  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { access } }
  );

  if (mainWindow) {
    mainWindow.webContents.send(IPC_EVENTS.backup_status, status);
  }

  return status;
}
