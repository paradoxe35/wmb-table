import { BackupStatus } from '../../types';
import { initBackupAndRestoration } from '../../utils/backup/backup';
import googleOAuth2, { getUserInfo } from '../../utils/backup/googleapi';
import db, { queryDb } from '../../utils/main/db';
import { app_settings } from './app_settings';
const isOnline = require('is-online');

export let DATA_RESTORED = false;

export async function backup_status(): Promise<BackupStatus | null> {
  const status = await queryDb.findOne<BackupStatus | null>(db.backupStatus);
  if (status) DATA_RESTORED = status.restored;
  return status;
}

export async function backup_reminder(): Promise<boolean> {
  let status = await app_settings();
  if (!status) return false;

  const lastUpdate = status.lastCheckBackupStatus.addDays(2);
  const now = new Date();
  if (lastUpdate >= now) return false;
  await queryDb.update(
    db.configurations,
    { _id: status._id },
    { $set: { lastCheckBackupStatus: now } }
  );
  return true;
}

export async function handle_backup_login() {
  if (!(await isOnline())) {
    return { error: 'network' };
  }
  const googleAuth = await googleOAuth2();
  if (!googleAuth) {
    return { error: 'auth' };
  }
  const payload = await getUserInfo(googleAuth);

  const statusBackup: Partial<BackupStatus> = {
    email: payload.email,
    name: payload.name,
    active: true,
    restored: false,
    lastUpdate: new Date(),
  };

  await queryDb.insert(db.backupStatus, payload);

  initBackupAndRestoration(googleAuth);

  return statusBackup;
}

export async function handle_backup_status() {
  const status = await backup_status();
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
  const status = await backup_status();
  if (!status) return null;
  DATA_RESTORED = restored;
  status.restored = restored;
  await queryDb.update(
    db.backupStatus,
    { _id: status._id },
    { $set: { restored } }
  );
  return status;
}
