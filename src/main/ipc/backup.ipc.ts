import { BackupChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as backupRepo from '@main/database/repositories/backup.repository';

export function registerBackupHandlers(): void {
    registerHandler(BackupChannels.getStatus, async () => {
        return backupRepo.getStatus();
    });

    registerHandler(BackupChannels.toggleStatus, async (_event, active) => {
        backupRepo.toggleStatus(active);
    });

    registerHandler(BackupChannels.getReminder, async () => {
        return backupRepo.getReminder();
    });

    registerHandler(BackupChannels.login, async () => {
        throw new Error('Not implemented: backup:login');
    });
}
