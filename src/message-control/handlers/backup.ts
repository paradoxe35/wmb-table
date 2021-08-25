import { AppSettingsStatus, BackupStatus } from '../../types';
import googleOAuth2, { getUserInfo } from '../../utils/backup/googleapi';
import db, { queryDb } from '../../utils/main/db';
const isOnline = require('is-online');

export async function backup_status(): Promise<BackupStatus | null> {
  return await queryDb.findOne<BackupStatus | null>(db.backupStatus);
}

export async function backup_reminder(): Promise<boolean> {
  let settings = await queryDb.find<AppSettingsStatus>(db.configurations);
  if (!settings[0]) return false;
  const status = settings[0] as AppSettingsStatus;

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

  const info = await getUserInfo(googleAuth.credentials.access_token as string);
  console.log(info);

  // googleAuth.credentials.access_token
  // google.acc
  return false;
}

export async function handle_backup_status() {}
