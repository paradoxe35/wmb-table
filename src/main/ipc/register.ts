import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { InvokeChannel, InvokeChannelMap, PushChannel, PushEventMap } from '@shared/ipc.types';
import { registerDocumentsHandlers } from './documents.ipc';
import { registerSearchHandlers } from './search.ipc';
import { registerNotesHandlers } from './notes.ipc';
import { registerBibleHandlers } from './bible.ipc';
import { registerSubjectsHandlers } from './subjects.ipc';
import { registerAudioHandlers } from './audio.ipc';
import { registerBackupHandlers } from './backup.ipc';
import { registerAppHandlers } from './app.ipc';
import { registerLanguageHandlers } from './languages.ipc';
import { registerSyncHandlers } from './sync.ipc';

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
            const error = err instanceof Error ? err : new Error(String(err));
            throw {
                __error: true,
                message: error.message,
                name: error.name,
                stack: error.stack,
            };
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

/**
 * Registers all domain IPC handlers. Call once before creating the window.
 */
export function initializeIpc(): void {
    registerDocumentsHandlers();
    registerSearchHandlers();
    registerNotesHandlers();
    registerBibleHandlers();
    registerSubjectsHandlers();
    registerAudioHandlers();
    registerBackupHandlers();
    registerAppHandlers();
    registerLanguageHandlers();
    registerSyncHandlers();
}
