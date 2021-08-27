import { AppSettingsStatus } from '../../types';
import db, { queryDb } from '../../utils/main/db';

export async function app_settings() {
  return await queryDb.findOne<AppSettingsStatus | null>(db.configurations);
}

export async function initialized_app() {
  const settings = await app_settings();

  if (!settings || !settings.initialized) {
    if (settings) {
      await queryDb.update(
        db.configurations,
        { _id: settings._id },
        { $set: { initialized: true } }
      );
    } else {
      await queryDb.insert(db.configurations, {
        initialized: true,
        lastCheckBackupStatus: new Date(),
      });
    }
    return false;
  }

  return true;
}
