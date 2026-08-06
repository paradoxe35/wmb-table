import { app, shell } from 'electron';
import { AppChannels } from '@shared/ipc.types';
import { applyResolvedTheme, getThemeState } from '@main/lib/native-theme';
import { registerHandler } from './register';
import * as configRepo from '@main/database/repositories/config.repository';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import * as historyRepo from '@main/database/repositories/history.repository';
import { refreshBibleDrizzle, switchBibleLanguage } from '@main/database/index';
import { closeBibleDb } from '@main/services/bible.service';
import { extractTextFromImportedDocument } from '@main/services/document-import.service';
import {
    getUpdateStatus,
    startDownload,
    cancelDownload,
    quitAndInstall,
    checkForUpdates,
} from '@main/lib/updater';
import i18n from '@main/lib/i18n';
import MenuBuilder from '@main/lib/menu';
import { getMainWindow } from '@main/lib/window';
import { resolveUiLanguage } from '@shared/constants';

const langToLocale: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
};

export function registerAppHandlers(): void {
    registerHandler(AppChannels.isInitialized, async () => {
        return configRepo.ensureConfig().initialized;
    });

    registerHandler(AppChannels.initialize, async () => {
        configRepo.markInitialized();
    });

    registerHandler(AppChannels.getContentLanguage, async () => {
        return configRepo.getContentLanguage();
    });

    registerHandler(AppChannels.setContentLanguage, async (_event, langCode) => {
        configRepo.setContentLanguage(langCode);
        if (langCode) {
            switchBibleLanguage(langCode);
            return;
        }

        configRepo.setActiveBibleVersionAbbreviation(null);
        closeBibleDb();
        refreshBibleDrizzle();
    });

    registerHandler(AppChannels.getRememberReadingPosition, async () => {
        return configRepo.getRememberReadingPosition();
    });

    registerHandler(AppChannels.setRememberReadingPosition, async (_event, value) => {
        configRepo.setRememberReadingPosition(value);
    });

    registerHandler(AppChannels.getMaxTabs, async () => {
        return configRepo.getMaxTabs();
    });

    registerHandler(AppChannels.setMaxTabs, async (_event, value) => {
        return configRepo.setMaxTabs(value);
    });

    registerHandler(AppChannels.openExternal, async (_event, url) => {
        await shell.openExternal(url);
    });

    registerHandler(AppChannels.restart, async () => {
        app.relaunch();
        app.exit(0);
    });

    registerHandler(AppChannels.getUpdateStatus, async () => {
        return getUpdateStatus();
    });

    registerHandler(AppChannels.startDownloadUpdate, async () => {
        return startDownload();
    });

    registerHandler(AppChannels.cancelDownloadUpdate, async () => {
        return cancelDownload();
    });

    registerHandler(AppChannels.quitAndInstallUpdate, async () => {
        quitAndInstall();
    });

    registerHandler(AppChannels.checkForUpdates, async () => {
        return checkForUpdates();
    });

    registerHandler(AppChannels.getSidebarStatus, async () => {
        return configRepo.getSidebarStatus();
    });

    registerHandler(AppChannels.setSidebarStatus, async (_event, hidden) => {
        configRepo.setSidebarStatus(hidden);
    });

    registerHandler(AppChannels.getCustomDocuments, async () => {
        return customDocsRepo.getCustomDocuments();
    });

    registerHandler(AppChannels.deleteCustomDocument, async (_event, id) => {
        customDocsRepo.deleteCustomDocument(id);
    });

    registerHandler(
        AppChannels.createCustomDocument,
        async (_event, title, input, languageCode) => {
            const content = await extractTextFromImportedDocument(input);
            return customDocsRepo.createCustomDocument(title, content, languageCode);
        },
    );

    registerHandler(AppChannels.getCustomDocumentContent, async (_event, id) => {
        return customDocsRepo.getCustomDocumentContent(id);
    });

    registerHandler(AppChannels.updateCustomDocumentLanguage, async (_event, id, languageCode) => {
        customDocsRepo.updateCustomDocumentLanguage(id, languageCode);
    });

    registerHandler(AppChannels.getHistory, async (_event, langCode) => {
        return historyRepo.getHistory(langCode);
    });

    registerHandler(AppChannels.addHistoryEntry, async (_event, langCode, entry) => {
        const now = new Date();
        const locale = langToLocale[langCode] ?? 'fr-FR';
        const date = now.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const milliseconds = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const time = now.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        });
        historyRepo.addHistoryEntry(date, milliseconds, time, langCode, entry);
    });

    registerHandler(AppChannels.getHistoryItems, async (_event, historyId) => {
        return historyRepo.getHistoryItems(historyId);
    });

    registerHandler(AppChannels.getUiLanguage, async () => {
        return configRepo.getUiLanguage();
    });

    registerHandler(AppChannels.setUiLanguage, async (_event, pref) => {
        configRepo.setUiLanguage(pref);

        const contentLang = configRepo.getContentLanguage();
        const resolved = resolveUiLanguage(pref, contentLang);

        await i18n.changeLanguage(resolved);

        const win = getMainWindow();
        if (win) {
            new MenuBuilder(win).buildMenu();
        }
    });

    registerHandler(AppChannels.getThemeState, async () => getThemeState());

    registerHandler(AppChannels.setThemeMode, async (_event, mode) => {
        configRepo.setThemeMode(mode);
        const state = getThemeState();
        applyResolvedTheme(state.resolvedTheme);
        return state;
    });

    registerHandler(AppChannels.refreshNativeTheme, async () => {
        const state = getThemeState();
        applyResolvedTheme(state.resolvedTheme);
        return state;
    });
}
