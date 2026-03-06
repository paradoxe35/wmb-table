import { app } from 'electron';
import { AppChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as configRepo from '@main/database/repositories/config.repository';
import * as sidebarRepo from '@main/database/repositories/sidebar.repository';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import * as historyRepo from '@main/database/repositories/history.repository';
import { switchBibleLanguage } from '@main/database/index';
import { extractTextFromPdf } from '@main/services/pdf-extract.service';
import { getUpdateStatus, startDownload, quitAndInstall } from '@main/lib/updater';

export function registerAppHandlers(): void {
    registerHandler(AppChannels.initialize, async () => {
        configRepo.markInitialized();
    });

    registerHandler(AppChannels.getActiveLanguage, async () => {
        const lang = configRepo.getActiveLanguage();
        console.log('[app.ipc] getActiveLanguage →', lang);
        return lang;
    });

    registerHandler(AppChannels.setActiveLanguage, async (_event, langCode) => {
        console.log('[app.ipc] setActiveLanguage →', langCode);
        configRepo.setActiveLanguage(langCode);
        switchBibleLanguage(langCode);
    });

    registerHandler(AppChannels.restart, async () => {
        app.relaunch();
        app.exit(0);
    });

    registerHandler(AppChannels.getUpdateStatus, async () => {
        return getUpdateStatus();
    });

    registerHandler(AppChannels.startDownloadUpdate, async () => {
        startDownload();
    });

    registerHandler(AppChannels.quitAndInstallUpdate, async () => {
        quitAndInstall();
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

    registerHandler(AppChannels.getHistory, async (_event, langCode) => {
        return historyRepo.getHistory(langCode);
    });

    registerHandler(
        AppChannels.addHistoryEntry,
        async (_event, langCode, documentTitle, sermonId) => {
            const now = new Date();
            const date = now.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const milliseconds = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            ).getTime();
            const time = now.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
            });
            historyRepo.addHistoryEntry(
                date,
                milliseconds,
                time,
                documentTitle,
                langCode,
                sermonId,
            );
        },
    );

    registerHandler(AppChannels.getHistoryItems, async (_event, historyId) => {
        return historyRepo.getHistoryItems(historyId);
    });
}
