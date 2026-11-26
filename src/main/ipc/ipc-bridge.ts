import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { InvokeChannel, InvokeChannelMap, PushChannel, PushEventMap } from '@shared/ipc.types';

/**
 * Type-safe wrapper around `ipcMain.handle`.
 * Serializes errors before crossing the IPC boundary.
 */
export function registerHandler<C extends InvokeChannel>(
    channel: C,
    handler: (
        event: IpcMainInvokeEvent,
        ...args: InvokeChannelMap[C]['args']
    ) => Promise<InvokeChannelMap[C]['return']> | InvokeChannelMap[C]['return'],
): void {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...(args as unknown as InvokeChannelMap[C]['args']));
        } catch (err) {
            let message: string;
            let name = 'Error';
            let stack: string | undefined;

            if (err instanceof Error) {
                message = err.message;
                name = err.name;
                stack = err.stack;
            } else if (err && typeof err === 'object' && 'message' in err) {
                message = String((err as { message: unknown }).message);
            } else if (typeof err === 'string') {
                message = err;
            } else {
                message = 'Une erreur inattendue est survenue.';
            }

            const forwarded = new Error(message);
            forwarded.name = name;
            if (stack) {
                forwarded.stack = stack;
            }
            throw forwarded;
        }
    });
}

/**
 * Type-safe wrapper around `webContents.send` for main → renderer push events.
 */
export function sendToRenderer<C extends PushChannel>(
    window: BrowserWindow,
    channel: C,
    ...args: PushEventMap[C] extends void ? [] : [PushEventMap[C]]
): void {
    if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args);
    }
}
