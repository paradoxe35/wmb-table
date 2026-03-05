import { AppChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as configRepo from '@main/database/repositories/config.repository';
import * as sidebarRepo from '@main/database/repositories/sidebar.repository';
import * as documentsRepo from '@main/database/repositories/documents.repository';
import * as historyRepo from '@main/database/repositories/history.repository';

export function registerAppHandlers(): void {
    registerHandler(AppChannels.initialize, async () => {
        configRepo.markInitialized();
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
        return sidebarRepo.getSidebarStatus();
    });

    registerHandler(AppChannels.setSidebarStatus, async (_event, hidden) => {
        sidebarRepo.setSidebarStatus(hidden);
    });

    registerHandler(AppChannels.getCustomDocuments, async () => {
        return documentsRepo.getCustomDocuments();
    });

    registerHandler(AppChannels.deleteCustomDocument, async (_event, id) => {
        documentsRepo.deleteCustomDocument(id);
    });

    registerHandler(AppChannels.uploadCustomDocuments, async () => {
        throw new Error('Not implemented: app:uploadCustomDocuments');
    });

    registerHandler(AppChannels.getHistory, async () => {
        return historyRepo.getHistory();
    });

    registerHandler(AppChannels.getHistoryItems, async (_event, historyId) => {
        return historyRepo.getHistoryItems(historyId);
    });

    registerHandler(AppChannels.downloadDocumentPdf, async () => {
        throw new Error('Not implemented: app:downloadDocumentPdf');
    });
}
