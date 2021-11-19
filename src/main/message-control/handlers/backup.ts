import { getAssetBackupPendingPath, mainWindow } from '@root/sys';
import { BackupStatus } from '@localtypes/index';
import {
  backupEventEmiter,
  backupPenging,
  CAN_WATCH_IS_ONLINE_EVENT,
  initBackupAndRestoration,
  resumeRestoration,
} from '@main/features/backup/backup';
import { setDataRestored } from '@main/features/backup/constants';
import googleOAuth2, { getUserInfo } from '@main/features/backup/googleapi';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { cleanAllFileDir } from '@main/functions/count-file-lines';
import db, { queryDb } from '@main/db/db';
import { app_settings } from './app_settings';
import isOnline from 'is-online';

let ACCESS_STATUS: { value: boolean } = { value: true };

export async function backup_status(
  onlyStatus: boolean | Object
): Promise<BackupStatus | null> {
  const status = await queryDb.findOne<BackupStatus | null>(db.backupStatus);

  if (status && status.access && typeof onlyStatus !== 'boolean') {
    setDataRestored(status.restored);
    // resume restoration or backup pending data
    !status.restored && resumeRestoration(status);
    if (status.restored) {
      backupPenging(status);
      backupEventEmiter.emit(CAN_WATCH_IS_ONLINE_EVENT);
    }
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
    access: ACCESS_STATUS.value,
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

  ACCESS_STATUS.value && initBackupAndRestoration(googleAuth);

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

  if (restored) {
    backupEventEmiter.emit(CAN_WATCH_IS_ONLINE_EVENT);
  }

  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { restored } }
  );

  return status;
}

export async function setUserAuthAccessStatus(access: boolean) {
  const status = await backup_status(true);

  ACCESS_STATUS.value = access;

  if (!status) {
    return null;
  }

  status.access = access;
  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { access } }
  );

  mainWindow?.webContents.send(IPC_EVENTS.backup_status, status);

  return status;
}
