import { TimerChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

/** A renderer timer that must survive throttling is a UI delay; anything longer is a job. */
const MAX_WAIT_MS = 60_000;

export function registerTimerHandlers(): void {
    registerHandler(TimerChannels.wait, async (_event, delayMs) => {
        const clamped = Math.min(Math.max(delayMs, 0), MAX_WAIT_MS);
        await new Promise<void>((resolve) => setTimeout(resolve, clamped));
    });
}
