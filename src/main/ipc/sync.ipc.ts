import { SyncChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { getSyncStatus } from '@main/services/sync/synchronizer';

export function registerSyncHandlers(): void {
    registerHandler(SyncChannels.getStatus, async () => {
        return getSyncStatus();
    });
}
