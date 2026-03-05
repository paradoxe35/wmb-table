import { BibleChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as bibleRepo from '@main/database/repositories/bible.repository';

export function registerBibleHandlers(): void {
  registerHandler(BibleChannels.getIndexes, async () => {
    return bibleRepo.getIndexes();
  });

  registerHandler(BibleChannels.getBooks, async (_event, request) => {
    return bibleRepo.getBooks(request);
  });

  registerHandler(BibleChannels.search, async (_event, query, pageNumber) => {
    return bibleRepo.search(query, pageNumber);
  });
}
