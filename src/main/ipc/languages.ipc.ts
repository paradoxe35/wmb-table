import { BrowserWindow } from 'electron';
import { LanguageChannels, PushChannels } from '@shared/ipc.types';
import { registerHandler, sendToRenderer } from './ipc-bridge';
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
        try {
            const result = await languagePackService.downloadLanguagePack(
                langCode,
                (percentage) => {
                    if (win && !win.isDestroyed()) {
                        sendToRenderer(win, PushChannels.languageDownloadProgress, {
                            langCode,
                            percentage,
                        });
                    }
                },
            );
            if (win && !win.isDestroyed()) {
                sendToRenderer(win, PushChannels.languageInstalled, {
                    langCode,
                    action: result.action,
                });
            }
        } catch (error) {
            if (win && !win.isDestroyed()) {
                sendToRenderer(win, PushChannels.languageInstallFailed, {
                    langCode,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            throw error;
        }
    });

    registerHandler(LanguageChannels.delete, async (_event, langCode) => {
        await languagePackService.deleteLanguagePack(langCode);
    });
}
