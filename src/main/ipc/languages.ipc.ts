import { BrowserWindow } from 'electron';
import { LanguageChannels, PushChannels } from '@shared/ipc.types';
import { registerHandler, sendToRenderer } from './register';
import * as languagePackService from '@main/services/language-pack.service';

export function registerLanguageHandlers(): void {
    registerHandler(LanguageChannels.getInstalled, async (_event, options) => {
        return languagePackService.getInstalledLanguages(options);
    });

    registerHandler(LanguageChannels.getAvailable, async () => {
        return languagePackService.getDownloadableLanguages();
    });

    registerHandler(LanguageChannels.install, async (event, langCode) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await languagePackService.downloadLanguagePack(langCode, (percentage) => {
            if (win && !win.isDestroyed()) {
                sendToRenderer(win, PushChannels.languageDownloadProgress, {
                    langCode,
                    percentage,
                });
            }
        });
        if (win && !win.isDestroyed()) {
            sendToRenderer(win, PushChannels.languageInstalled, {
                langCode,
                action: result.action,
            });
        }
    });

    registerHandler(LanguageChannels.delete, async (_event, langCode) => {
        await languagePackService.deleteLanguagePack(langCode);
    });
}
