import { pushToRenderer } from '@main/lib/push';
import { PushChannels } from '@shared/ipc.types';

/** Small catch-ups finish before a progress indicator would be readable. */
const MIN_FILES_TO_REPORT = 50;
const REPORT_EVERY = 10;

export interface RemoteApplyProgress {
    advance(processed: number): void;
    finish(): void;
}

const IDLE: RemoteApplyProgress = {
    advance: () => {},
    finish: () => {},
};

export function createRemoteApplyProgress(total: number): RemoteApplyProgress {
    if (total < MIN_FILES_TO_REPORT) {
        return IDLE;
    }

    pushToRenderer(PushChannels.syncProgress, { processed: 0, total });

    return {
        advance(processed: number): void {
            if (processed % REPORT_EVERY === 0 || processed === total) {
                pushToRenderer(PushChannels.syncProgress, { processed, total });
            }
        },
        finish(): void {
            pushToRenderer(PushChannels.syncProgress, null);
        },
    };
}
