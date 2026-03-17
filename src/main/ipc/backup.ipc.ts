import { BackupChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as backupRepo from '@main/database/repositories/backup.repository';
import {
    authenticateWithGoogle,
    revokeAndDeleteToken,
} from '@main/services/sync/google-auth.service';
import {
    initializeSynchronizer,
    stopSynchronizer,
    clearSyncData,
    tryStartSynchronizer,
} from '@main/services/sync/synchronizer';

export function registerBackupHandlers(): void {
    registerHandler(BackupChannels.getStatus, async () => {
        return backupRepo.getStatus();
    });

    registerHandler(BackupChannels.toggleStatus, async (_event, active) => {
        backupRepo.toggleStatus(active);
        if (active) {
            await tryStartSynchronizer();
        } else {
            stopSynchronizer();
        }
    });

    registerHandler(BackupChannels.getReminder, async () => {
        return backupRepo.getReminder();
    });

    registerHandler(BackupChannels.login, async () => {
        const result = await authenticateWithGoogle();

        backupRepo.upsertStatus({
            email: result.userInfo.email,
            name: result.userInfo.name,
            active: true,
            access: true,
            restored: true,
            lastUpdate: new Date(),
        });

        initializeSynchronizer(result.client);

        return backupRepo.getStatus();
    });

    registerHandler(BackupChannels.logout, async () => {
        stopSynchronizer();
        await revokeAndDeleteToken();
        clearSyncData();
        backupRepo.deleteStatus();
    });
}
