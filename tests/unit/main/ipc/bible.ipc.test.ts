import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BibleChannels, PushChannels } from '@shared/ipc.types';

const registerHandlerMock = vi.fn();
const sendToRendererMock = vi.fn();
const downloadBibleVersionMock = vi.fn();
const getBibleVersionToAutoActivateAfterDownloadMock = vi.fn();
const switchBibleVersionMock = vi.fn();

vi.mock('@main/ipc/register', () => ({
    registerHandler: registerHandlerMock,
    sendToRenderer: sendToRendererMock,
}));

vi.mock('@main/services/bible.service', () => ({
    downloadBibleVersion: downloadBibleVersionMock,
    getBibleVersionToAutoActivateAfterDownload: getBibleVersionToAutoActivateAfterDownloadMock,
    switchBibleVersion: switchBibleVersionMock,
}));

vi.mock('@main/database/repositories/bible.repository', () => ({
    getIndexes: vi.fn(),
    getBooks: vi.fn(),
    search: vi.fn(),
}));

vi.mock('@main/database/repositories/config.repository', () => ({
    getContentLanguage: vi.fn(),
    setActiveBibleVersionAbbreviation: vi.fn(),
}));

vi.mock('@main/database/index', () => ({
    refreshBibleDrizzle: vi.fn(),
}));

vi.mock('electron', () => ({
    BrowserWindow: {
        fromWebContents: vi.fn(),
    },
}));

describe('registerBibleHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        downloadBibleVersionMock.mockReset();
        getBibleVersionToAutoActivateAfterDownloadMock.mockReset();
        switchBibleVersionMock.mockReset();
    });

    it('pushes progress and completion for successful downloads', async () => {
        const win = { isDestroyed: vi.fn(() => false) };
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(win as never);

        downloadBibleVersionMock.mockImplementation(
            async (_abbreviation: string, onProgress?: (percentage: number) => void) => {
                onProgress?.(45);
            },
        );

        const { registerBibleHandlers } = await import('@main/ipc/bible.ipc');
        registerBibleHandlers();

        const handler = registerHandlerMock.mock.calls.find(
            ([channel]) => channel === BibleChannels.downloadVersion,
        )?.[1];
        expect(handler).toBeTypeOf('function');

        await handler({ sender: {} }, 'en-kjv');

        expect(sendToRendererMock).toHaveBeenNthCalledWith(
            1,
            win,
            PushChannels.bibleDownloadProgress,
            {
                abbreviation: 'en-kjv',
                percentage: 45,
            },
        );
        expect(sendToRendererMock).toHaveBeenNthCalledWith(2, win, PushChannels.bibleDownloaded, {
            abbreviation: 'en-kjv',
        });
    });

    it('pushes a failure event when the download throws', async () => {
        const win = { isDestroyed: vi.fn(() => false) };
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(win as never);

        downloadBibleVersionMock.mockRejectedValue(new Error('network down'));

        const { registerBibleHandlers } = await import('@main/ipc/bible.ipc');
        registerBibleHandlers();

        const handler = registerHandlerMock.mock.calls.find(
            ([channel]) => channel === BibleChannels.downloadVersion,
        )?.[1];
        expect(handler).toBeTypeOf('function');

        await expect(handler({ sender: {} }, 'en-kjv')).rejects.toThrow('network down');
        expect(sendToRendererMock).toHaveBeenCalledWith(win, PushChannels.bibleDownloadFailed, {
            abbreviation: 'en-kjv',
            error: 'network down',
        });
    });

    it('auto-selects the first downloaded Bible for the current content language', async () => {
        const win = { isDestroyed: vi.fn(() => false) };
        const { BrowserWindow } = await import('electron');
        const configRepo = await import('@main/database/repositories/config.repository');
        const database = await import('@main/database/index');

        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(win as never);
        vi.mocked(configRepo.getContentLanguage).mockReturnValue('es');
        getBibleVersionToAutoActivateAfterDownloadMock.mockReturnValue({
            abbreviation: 'es-rv',
            langCode: 'es',
            name: 'RV',
            fileName: 'es-rv.sqlite',
            type: 'remote',
        });
        switchBibleVersionMock.mockReturnValue({
            abbreviation: 'es-rv',
        });

        const { registerBibleHandlers } = await import('@main/ipc/bible.ipc');
        registerBibleHandlers();

        const handler = registerHandlerMock.mock.calls.find(
            ([channel]) => channel === BibleChannels.downloadVersion,
        )?.[1];
        expect(handler).toBeTypeOf('function');

        await handler({ sender: {} }, 'es-rv');

        expect(getBibleVersionToAutoActivateAfterDownloadMock).toHaveBeenCalledWith('es', 'es-rv');
        expect(switchBibleVersionMock).toHaveBeenCalledWith('es-rv');
        expect(database.refreshBibleDrizzle).toHaveBeenCalled();
        expect(configRepo.setActiveBibleVersionAbbreviation).toHaveBeenCalledWith('es-rv');
        expect(sendToRendererMock).toHaveBeenCalledWith(win, PushChannels.bibleDownloaded, {
            abbreviation: 'es-rv',
        });
    });
});
