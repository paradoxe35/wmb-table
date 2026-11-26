import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stopForWindowMock = vi.fn();
const removeAbandonedRepliesMock = vi.fn();
const disposeMock = vi.fn();

vi.mock('@main/services/ai/ai.service', () => ({
    AiService: class {
        stopGenerationsForWindow = stopForWindowMock;
        removeAbandonedReplies = removeAbandonedRepliesMock;
        dispose = disposeMock;
    },
}));

const { getAiService, disposeAiService, stopAiRunsWhenPageGoes } =
    await import('@main/services/ai');

function fakeWindow() {
    const window = Object.assign(new EventEmitter(), { webContents: new EventEmitter() });
    return window;
}

describe('AI service lifetime', () => {
    beforeEach(() => {
        disposeAiService();
        vi.clearAllMocks();
    });

    it('removes replies abandoned by an earlier session once, when the service starts', () => {
        getAiService();
        getAiService();

        expect(removeAbandonedRepliesMock).toHaveBeenCalledTimes(1);
    });

    it('stops the runs of a window that is closed, crashed or reloaded', () => {
        const window = fakeWindow();
        getAiService();
        stopAiRunsWhenPageGoes(window as never);

        window.emit('closed');
        window.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
        window.webContents.emit('did-start-navigation', {
            isMainFrame: true,
            isSameDocument: false,
        });

        expect(stopForWindowMock).toHaveBeenCalledTimes(3);
        expect(stopForWindowMock).toHaveBeenCalledWith(window);
    });

    it('keeps the runs on in-page navigation and frame loads', () => {
        const window = fakeWindow();
        getAiService();
        stopAiRunsWhenPageGoes(window as never);

        window.webContents.emit('did-start-navigation', {
            isMainFrame: true,
            isSameDocument: true,
        });
        window.webContents.emit('did-start-navigation', {
            isMainFrame: false,
            isSameDocument: false,
        });

        expect(stopForWindowMock).not.toHaveBeenCalled();
    });

    it('does not start the service just to stop nothing', () => {
        const window = fakeWindow();
        stopAiRunsWhenPageGoes(window as never);

        window.emit('closed');

        expect(removeAbandonedRepliesMock).not.toHaveBeenCalled();
    });
});
