import { BrowserWindow } from 'electron';
import { BibleChannels, PushChannels } from '@shared/ipc.types';
import { registerHandler, sendToRenderer } from './register';
import * as bibleRepo from '@main/database/repositories/bible.repository';
import * as bibleService from '@main/services/bible.service';
import * as configRepo from '@main/database/repositories/config.repository';
import { refreshBibleDrizzle } from '@main/database/index';
import type { BibleVersionInfo } from '@shared/types';

function toBibleVersionInfo(v: bibleService.BibleVersion): BibleVersionInfo {
    return {
        langCode: v.langCode,
        abbreviation: v.abbreviation,
        name: v.name,
        type: v.type,
        available: bibleService.isBibleAvailable(v),
    };
}

export function registerBibleHandlers(): void {
    registerHandler(BibleChannels.getIndexes, async () => {
        return bibleRepo.getIndexes();
    });

    registerHandler(BibleChannels.getBooks, async (_event, request) => {
        return bibleRepo.getBooks(request);
    });

    registerHandler(BibleChannels.search, async (_event, query, pageNumber, testament) => {
        return bibleRepo.search(query, pageNumber, testament);
    });

    registerHandler(BibleChannels.getVersions, async () => {
        const langCode = configRepo.getContentLanguage();
        if (!langCode) return [];
        return bibleService.getBibleVersionsForLanguage(langCode).map(toBibleVersionInfo);
    });

    registerHandler(BibleChannels.getAllVersions, async () => {
        return bibleService.getAllBibleVersions().map(toBibleVersionInfo);
    });

    registerHandler(BibleChannels.getActiveVersion, async () => {
        const version = bibleService.getActiveVersion();
        if (!version) return null;
        return toBibleVersionInfo(version);
    });

    registerHandler(BibleChannels.switchVersion, async (_event, abbreviation) => {
        bibleService.switchBibleVersion(abbreviation);
        refreshBibleDrizzle();
    });

    registerHandler(BibleChannels.refreshIndex, async () => {
        const versions = await bibleService.refreshRemoteIndex();
        return versions.map(toBibleVersionInfo);
    });

    registerHandler(BibleChannels.downloadVersion, async (_event, abbreviation) => {
        const win = BrowserWindow.getFocusedWindow();
        await bibleService.downloadBibleVersion(abbreviation, (percentage) => {
            if (win) {
                sendToRenderer(win, PushChannels.bibleDownloadProgress, {
                    abbreviation,
                    percentage,
                });
            }
        });
        if (win) {
            sendToRenderer(win, PushChannels.bibleDownloaded, { abbreviation });
        }
    });
}
