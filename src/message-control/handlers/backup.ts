import { AppSettingsStatus, BackupStatus } from '../../types';
import db, { queryDb } from '../../utils/main/db';
import { initialized_app } from './app_settings';

export async function backup_status(): Promise<BackupStatus | null> {
  return await queryDb.findOne<BackupStatus | null>(db.backupStatus);
}

export async function backup_reminder(): Promise<boolean> {
  let settings = await initialized_app(true);
  if (!settings) return false;
  const status = settings as AppSettingsStatus;

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

export async function handle_backup_login() {}

export async function handle_backup_status() {}
