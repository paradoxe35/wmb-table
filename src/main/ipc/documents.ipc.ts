import { DocumentChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerDocumentsHandlers(): void {
  registerHandler(DocumentChannels.getTitles, async () => {
    throw new Error('Not implemented: documents:getTitles');
  });

  registerHandler(DocumentChannels.getContentPath, async () => {
    throw new Error('Not implemented: documents:getContentPath');
  });

  registerHandler(DocumentChannels.getTabs, async () => {
    throw new Error('Not implemented: documents:getTabs');
  });

  registerHandler(DocumentChannels.saveTabs, async () => {
    throw new Error('Not implemented: documents:saveTabs');
  });
}
