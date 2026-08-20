import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { UnthrottledTimer, type WaitFn } from '@renderer/services/unthrottled-timer';

function controllableWait() {
    const pending: { resolve: () => void; reject: () => void; delayMs: number }[] = [];
    const wait: WaitFn = (delayMs) =>
        new Promise<void>((resolve, reject) => pending.push({ resolve, reject, delayMs }));
    return { wait, pending };
}

async function settleAfter(
    pending: { resolve: () => void }[],
    index: number,
    elapsedMs: number,
): Promise<void> {
    vi.setSystemTime(Date.now() + elapsedMs);
    pending[index].resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('UnthrottledTimer', () => {
    it('runs the callback once the wait resolves', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);
        const run = vi.fn();

        timer.schedule(300, run);
        expect(run).not.toHaveBeenCalled();
        expect(pending[0].delayMs).toBe(300);

        pending[0].resolve();
        await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    });

    it('reports pending between scheduling and firing', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);

        expect(timer.pending).toBe(false);
        timer.schedule(300, () => {});
        expect(timer.pending).toBe(true);

        pending[0].resolve();
        await vi.waitFor(() => expect(timer.pending).toBe(false));
    });

    it('does not run a cancelled callback when its wait resolves late', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);
        const run = vi.fn();

        timer.schedule(300, run);
        timer.cancel();
        expect(timer.pending).toBe(false);

        pending[0].resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(run).not.toHaveBeenCalled();
    });

    it('runs only the latest callback when rescheduled', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);
        const first = vi.fn();
        const second = vi.fn();

        timer.schedule(300, first);
        timer.schedule(100, second);

        pending[0].resolve();
        pending[1].resolve();
        await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
        expect(first).not.toHaveBeenCalled();
    });

    it('still runs the callback when the wait fails', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);
        const run = vi.fn();

        timer.schedule(300, run);
        pending[0].reject();

        await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
        expect(timer.pending).toBe(false);
    });

    it('ignores a failed wait that was already cancelled', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);
        const run = vi.fn();

        timer.schedule(300, run);
        timer.cancel();
        pending[0].reject();

        await Promise.resolve();
        await Promise.resolve();
        expect(run).not.toHaveBeenCalled();
    });
});

describe('UnthrottledTimer overhead compensation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('asks for the full delay before it has measured anything', () => {
        const { wait, pending } = controllableWait();
        new UnthrottledTimer(wait).schedule(300, () => {});

        expect(pending[0].delayMs).toBe(300);
    });

    it('subtracts the measured round trip from later waits', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);

        timer.schedule(300, () => {});
        await settleAfter(pending, 0, 300 + 8);

        timer.schedule(300, () => {});
        expect(pending[1].delayMs).toBe(292);
    });

    it('keeps the smallest sample so a slow one cannot cut the gap short', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);

        timer.schedule(300, () => {});
        await settleAfter(pending, 0, 300 + 5);

        timer.schedule(295, () => {});
        await settleAfter(pending, 1, 295 + 40);

        timer.schedule(300, () => {});
        expect(pending[2].delayMs).toBe(295);
    });

    it('ignores a stall rather than learning it as overhead', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);

        timer.schedule(300, () => {});
        await settleAfter(pending, 0, 300 + 5_000);

        timer.schedule(300, () => {});
        expect(pending[1].delayMs).toBe(300);
    });

    it('never asks for a negative delay', async () => {
        const { wait, pending } = controllableWait();
        const timer = new UnthrottledTimer(wait);

        timer.schedule(50, () => {});
        await settleAfter(pending, 0, 50 + 90);

        timer.schedule(10, () => {});
        expect(pending[1].delayMs).toBe(0);
    });
});
