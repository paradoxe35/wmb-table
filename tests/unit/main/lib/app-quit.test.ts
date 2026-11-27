import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const app = Object.assign(new EventEmitter(), { exit: vi.fn() });
const errorMock = vi.fn();

vi.mock('electron', () => ({ app }));
vi.mock('@main/lib/logger', () => ({ default: { error: errorMock } }));

async function loadQuit() {
    vi.resetModules();
    app.removeAllListeners();
    return import('@main/lib/app-quit');
}

function emitWillQuit() {
    const event = { preventDefault: vi.fn() };
    app.emit('will-quit', event);
    return event;
}

describe('quitAfterStopping', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        app.exit.mockReset();
        errorMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stops the services, then exits the process instead of quitting again', async () => {
        const { quitAfterStopping, isShuttingDown } = await loadQuit();
        let finishStop!: () => void;
        const stopServices = vi.fn(() => new Promise<void>((resolve) => (finishStop = resolve)));
        quitAfterStopping(stopServices);

        const event = emitWillQuit();

        expect(event.preventDefault).toHaveBeenCalled();
        expect(isShuttingDown()).toBe(true);
        expect(stopServices).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(100);
        expect(app.exit).not.toHaveBeenCalled();

        finishStop();
        await vi.advanceTimersByTimeAsync(0);
        expect(app.exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it('stops the services only once when quit is asked again while stopping', async () => {
        const { quitAfterStopping } = await loadQuit();
        const stopServices = vi.fn(() => new Promise<void>(() => {}));
        quitAfterStopping(stopServices);

        emitWillQuit();
        const second = emitWillQuit();

        expect(second.preventDefault).toHaveBeenCalled();
        expect(stopServices).toHaveBeenCalledTimes(1);
    });

    it('still exits when a service never finishes stopping', async () => {
        const { quitAfterStopping } = await loadQuit();
        quitAfterStopping(() => new Promise<void>(() => {}));

        emitWillQuit();
        await vi.advanceTimersByTimeAsync(4_999);
        expect(app.exit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(app.exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it('logs a failed stop and still exits', async () => {
        const { quitAfterStopping } = await loadQuit();
        const failure = new Error('close failed');
        quitAfterStopping(() => Promise.reject(failure));

        emitWillQuit();
        await vi.advanceTimersByTimeAsync(0);

        expect(errorMock).toHaveBeenCalledWith('[quit] Stopping services failed:', failure);
        expect(app.exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it('is not shutting down before the first quit request', async () => {
        const { quitAfterStopping, isShuttingDown } = await loadQuit();
        quitAfterStopping(async () => {});

        expect(isShuttingDown()).toBe(false);
    });
});
