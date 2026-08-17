import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PushChannels } from '@shared/ipc.types';

const pushToRendererMock = vi.fn();
vi.mock('@main/lib/push', () => ({ pushToRenderer: pushToRendererMock }));

const { createRemoteApplyProgress } = await import('@main/services/sync/sync-progress');

function reportedProgress() {
    return pushToRendererMock.mock.calls
        .filter(([channel]) => channel === PushChannels.syncProgress)
        .map(([, payload]) => payload);
}

describe('remote apply progress', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stays silent for a catch-up too small to be worth showing', () => {
        const progress = createRemoteApplyProgress(49);

        for (let processed = 1; processed <= 49; processed++) {
            progress.advance(processed);
        }
        progress.finish();

        expect(reportedProgress()).toEqual([]);
    });

    it('announces itself before the first file is applied', () => {
        createRemoteApplyProgress(50);

        expect(reportedProgress()).toEqual([{ processed: 0, total: 50 }]);
    });

    it('reports every tenth file and the last one', () => {
        const progress = createRemoteApplyProgress(55);

        for (let processed = 1; processed <= 55; processed++) {
            progress.advance(processed);
        }

        expect(reportedProgress()).toEqual([
            { processed: 0, total: 55 },
            { processed: 10, total: 55 },
            { processed: 20, total: 55 },
            { processed: 30, total: 55 },
            { processed: 40, total: 55 },
            { processed: 50, total: 55 },
            { processed: 55, total: 55 },
        ]);
    });

    it('clears the indicator when the run ends', () => {
        const progress = createRemoteApplyProgress(50);
        progress.finish();

        expect(reportedProgress().at(-1)).toBeNull();
    });
});
