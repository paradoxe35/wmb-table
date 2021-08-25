import { AppSettingsStatus } from '../../types';
import db, { queryDb } from '../../utils/main/db';

// let config: AppSettingsStatus | undefined;

export async function initialized_app() {
  const settings = await queryDb.find<AppSettingsStatus>(db.configurations);
  // if (settings[0]) config = settings[0];

  if (settings.length === 0 || !settings[0].initialized) {
    if (settings[0]) {
      await queryDb.update(
        db.configurations,
        { _id: settings[0]._id },
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
