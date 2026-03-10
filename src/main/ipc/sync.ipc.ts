import { SyncChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import {
    getSyncStatus,
    tryStartSynchronizer,
    stopSynchronizer,
    syncNow,
} from '@main/services/sync/synchronizer';

export function registerSyncHandlers(): void {
    registerHandler(SyncChannels.getStatus, async () => {
        return getSyncStatus();
    });

    registerHandler(SyncChannels.start, async () => {
        await tryStartSynchronizer();
    });

    registerHandler(SyncChannels.stop, async () => {
        stopSynchronizer();
    });

    registerHandler(SyncChannels.syncNow, async () => {
        syncNow();
    });
}
