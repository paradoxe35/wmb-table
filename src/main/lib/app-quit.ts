import { app } from 'electron';
import log from '@main/lib/logger';

const STOP_TIMEOUT_MS = 5_000;

let shuttingDown = false;

/** True from the first quit request on: the database may already be closed. */
export function isShuttingDown(): boolean {
    return shuttingDown;
}

/**
 * Runs `stopServices` once when the app quits, then exits. A second `app.quit()` after
 * `preventDefault` is ignored on macOS, which left the process alive with a closed database.
 */
export function quitAfterStopping(stopServices: () => Promise<void>): void {
    app.on('will-quit', (event) => {
        event.preventDefault();
        if (shuttingDown) return;
        shuttingDown = true;
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS));
        void Promise.race([stopServices(), timeout])
            .catch((error) => log.error('[quit] Stopping services failed:', error))
            .finally(() => app.exit(0));
    });
}
