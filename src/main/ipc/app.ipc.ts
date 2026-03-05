import { AppChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as configRepo from '@main/database/repositories/config.repository';
import * as sidebarRepo from '@main/database/repositories/sidebar.repository';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import * as historyRepo from '@main/database/repositories/history.repository';
import { switchBibleLanguage } from '@main/database/index';
import { extractTextFromPdf } from '@main/services/pdf-extract.service';

export function registerAppHandlers(): void {
    registerHandler(AppChannels.initialize, async () => {
        configRepo.markInitialized();
    });

    registerHandler(AppChannels.getActiveLanguage, async () => {
        return configRepo.getActiveLanguage();
    });

    registerHandler(AppChannels.setActiveLanguage, async (_event, langCode) => {
        configRepo.setActiveLanguage(langCode);
        switchBibleLanguage(langCode);
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
        return customDocsRepo.getCustomDocuments();
    });

    registerHandler(AppChannels.deleteCustomDocument, async (_event, id) => {
        customDocsRepo.deleteCustomDocument(id);
    });

    registerHandler(AppChannels.createCustomDocument, async (_event, title, pdfBytes) => {
        const content = await extractTextFromPdf(pdfBytes);
        return customDocsRepo.createCustomDocument(title, content);
    });

    registerHandler(AppChannels.getCustomDocumentContent, async (_event, id) => {
        return customDocsRepo.getCustomDocumentContent(id);
    });

    registerHandler(AppChannels.getHistory, async () => {
        return historyRepo.getHistory();
    });

    registerHandler(AppChannels.getHistoryItems, async (_event, historyId) => {
        return historyRepo.getHistoryItems(historyId);
    });
}
