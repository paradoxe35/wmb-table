import db, { queryDb } from '@main/db/db';
import { IPC_EVENTS } from '@root/utils/ipc-events';
import { DataDocument } from '@localtypes/index';

export default async (_: Electron.IpcMainEvent, tabs: DataDocument[]) => {
  const query = {
    tabs: IPC_EVENTS.document_tabs,
  };

  const documents = await queryDb.findOne<{ datas: DataDocument[] }>(
    db.tabs,
    query,
    {
      datas: 1,
    },
    {
      createdAt: -1,
    }
  );

  // update or insert
  if (tabs) {
    const { numAffected } = await queryDb.update(db.tabs, query, {
      $set: { datas: tabs },
    });
    if (!numAffected && !documents) {
      queryDb.insert(db.tabs, { ...query, datas: tabs });
    }
    db.tabs?.persistence.compactDatafile();
  }
  return documents?.datas || tabs;
};
