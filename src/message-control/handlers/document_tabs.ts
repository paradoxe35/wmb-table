import db, { queryDb } from '../../utils/main/db';
import { IPC_EVENTS } from '../../utils/ipc-events';
import { DataDocument } from '../../types';

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
  }
  return documents?.datas || tabs;
};
