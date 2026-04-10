import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageChannels, PushChannels } from '@shared/ipc.types';

const registerHandlerMock = vi.fn();
const sendToRendererMock = vi.fn();
const downloadLanguagePackMock = vi.fn();

vi.mock('@main/ipc/register', () => ({
    registerHandler: registerHandlerMock,
    sendToRenderer: sendToRendererMock,
}));

vi.mock('@main/services/language-pack.service', () => ({
    getInstalledLanguages: vi.fn(),
    getDownloadableLanguages: vi.fn(),
    downloadLanguagePack: downloadLanguagePackMock,
    deleteLanguagePack: vi.fn(),
}));

vi.mock('electron', () => ({
    BrowserWindow: {
        fromWebContents: vi.fn(),
    },
}));

describe('registerLanguageHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pushes progress and installed event for successful installs', async () => {
        const win = { isDestroyed: vi.fn(() => false) };
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(win as never);

        downloadLanguagePackMock.mockImplementation(
            async (_langCode: string, onProgress: (percentage: number) => void) => {
                onProgress(73);
                return { action: 'installed' };
            },
        );

        const { registerLanguageHandlers } = await import('@main/ipc/languages.ipc');
        registerLanguageHandlers();

        const handler = registerHandlerMock.mock.calls.find(
            ([channel]) => channel === LanguageChannels.install,
        )?.[1];
        expect(handler).toBeTypeOf('function');

        await handler({ sender: {} }, 'fr');

        expect(sendToRendererMock).toHaveBeenNthCalledWith(
            1,
            win,
            PushChannels.languageDownloadProgress,
            {
                langCode: 'fr',
                percentage: 73,
            },
        );
        expect(sendToRendererMock).toHaveBeenNthCalledWith(2, win, PushChannels.languageInstalled, {
            langCode: 'fr',
            action: 'installed',
        });
    });

    it('pushes a failure event when installation throws', async () => {
        const win = { isDestroyed: vi.fn(() => false) };
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(win as never);

        downloadLanguagePackMock.mockRejectedValue(new Error('download failed'));

        const { registerLanguageHandlers } = await import('@main/ipc/languages.ipc');
        registerLanguageHandlers();

        const handler = registerHandlerMock.mock.calls.find(
            ([channel]) => channel === LanguageChannels.install,
        )?.[1];
        expect(handler).toBeTypeOf('function');

        await expect(handler({ sender: {} }, 'fr')).rejects.toThrow('download failed');
        expect(sendToRendererMock).toHaveBeenCalledWith(win, PushChannels.languageInstallFailed, {
            langCode: 'fr',
            error: 'download failed',
        });
    });
});
