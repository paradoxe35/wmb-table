import db, { queryDb } from '../../utils/db';
import { IPC_EVENTS } from '../../utils/ipc-events';

export default async (_: Electron.IpcMainEvent, menu: string | undefined) => {
  const query = {
    viewer: IPC_EVENTS.menu_viewer,
  };

  const viewer = await queryDb.findOne<{ menu: string }>(db.menus, query, {
    menu: 1,
  });

  // update or insert
  if (menu && viewer?.menu !== menu) {
    const { numAffected } = await queryDb.update(db.menus, query, {
      $set: { menu },
    });
    if (!numAffected) {
      queryDb.insert(db.menus, { ...query, menu });
    }
  }
  return viewer?.menu || menu;
};
