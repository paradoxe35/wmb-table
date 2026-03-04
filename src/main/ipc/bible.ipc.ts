import { BibleChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerBibleHandlers(): void {
  registerHandler(BibleChannels.getIndexes, async () => {
    throw new Error('Not implemented: bible:getIndexes');
  });

  registerHandler(BibleChannels.getBooks, async () => {
    throw new Error('Not implemented: bible:getBooks');
  });

  registerHandler(BibleChannels.search, async () => {
    throw new Error('Not implemented: bible:search');
  });
}
