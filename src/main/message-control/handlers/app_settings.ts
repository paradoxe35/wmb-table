import { AppSettingsStatus } from '@localtypes/index';
import db, { queryDb } from '@main/db/db';
import { app } from 'electron';
import UpdaterInMemoryDatastore from '@main/features/app-updater/datastore';

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

export async function restart_app() {
  app.relaunch();
  app.quit();
}

export async function started_to_update() {
  const datastore = new UpdaterInMemoryDatastore();
  const info = await datastore.instance();
  return {
    started_to_update: !!info.restartedToUpdate,
    info,
  };
}
