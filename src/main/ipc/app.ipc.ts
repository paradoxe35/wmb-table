import { AppChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerAppHandlers(): void {
  registerHandler(AppChannels.initialize, async () => {
    throw new Error('Not implemented: app:initialize');
  });

  registerHandler(AppChannels.restart, async () => {
    throw new Error('Not implemented: app:restart');
  });

  registerHandler(AppChannels.getUpdateStatus, async () => {
    throw new Error('Not implemented: app:getUpdateStatus');
  });

  registerHandler(AppChannels.startDownloadUpdate, async () => {
    throw new Error('Not implemented: app:startDownloadUpdate');
  });

  registerHandler(AppChannels.quitAndInstallUpdate, async () => {
    throw new Error('Not implemented: app:quitAndInstallUpdate');
  });

  registerHandler(AppChannels.getAsset, async () => {
    throw new Error('Not implemented: app:getAsset');
  });

  registerHandler(AppChannels.getSidebarStatus, async () => {
    throw new Error('Not implemented: app:getSidebarStatus');
  });

  registerHandler(AppChannels.setSidebarStatus, async () => {
    throw new Error('Not implemented: app:setSidebarStatus');
  });

  registerHandler(AppChannels.getCustomDocuments, async () => {
    throw new Error('Not implemented: app:getCustomDocuments');
  });

  registerHandler(AppChannels.deleteCustomDocument, async () => {
    throw new Error('Not implemented: app:deleteCustomDocument');
  });

  registerHandler(AppChannels.uploadCustomDocuments, async () => {
    throw new Error('Not implemented: app:uploadCustomDocuments');
  });

  registerHandler(AppChannels.getHistory, async () => {
    throw new Error('Not implemented: app:getHistory');
  });

  registerHandler(AppChannels.getHistoryItems, async () => {
    throw new Error('Not implemented: app:getHistoryItems');
  });

  registerHandler(AppChannels.downloadDocumentPdf, async () => {
    throw new Error('Not implemented: app:downloadDocumentPdf');
  });
}
