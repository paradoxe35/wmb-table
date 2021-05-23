import { mainMessageTransport } from './ipc/ipc-main';
import { Title } from '../types';
import db, { queryDb } from '../utils/db';
import { IPC_EVENTS } from '../utils/ipc-events';

mainMessageTransport(IPC_EVENTS.title_documents, async () => {
  return await queryDb.find<Title>(db.documents, {}, { title: 1 });
});
