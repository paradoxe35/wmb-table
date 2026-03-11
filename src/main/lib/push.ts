import type { PushChannel, PushEventMap } from '@shared/ipc.types';
import { getMainWindow } from './window';

/**
 * Send a type-safe push event to the renderer process.
 * No-op if the window doesn't exist or is destroyed.
 */
export function pushToRenderer<C extends PushChannel>(
    channel: C,
    ...args: PushEventMap[C] extends void ? [] : [PushEventMap[C]]
): void {
    try {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, ...args);
        }
    } catch {
        // Window may not exist yet
    }
}
