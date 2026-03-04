import { SubjectChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerSubjectsHandlers(): void {
  registerHandler(SubjectChannels.getAll, async () => {
    throw new Error('Not implemented: subjects:getAll');
  });

  registerHandler(SubjectChannels.create, async () => {
    throw new Error('Not implemented: subjects:create');
  });

  registerHandler(SubjectChannels.delete, async () => {
    throw new Error('Not implemented: subjects:delete');
  });

  registerHandler(SubjectChannels.getItems, async () => {
    throw new Error('Not implemented: subjects:getItems');
  });

  registerHandler(SubjectChannels.deleteItem, async () => {
    throw new Error('Not implemented: subjects:deleteItem');
  });

  registerHandler(SubjectChannels.createItem, async () => {
    throw new Error('Not implemented: subjects:createItem');
  });
}
