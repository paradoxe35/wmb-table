import { BackupChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerBackupHandlers(): void {
  registerHandler(BackupChannels.getStatus, async () => {
    throw new Error('Not implemented: backup:getStatus');
  });

  registerHandler(BackupChannels.toggleStatus, async () => {
    throw new Error('Not implemented: backup:toggleStatus');
  });

  registerHandler(BackupChannels.getReminder, async () => {
    throw new Error('Not implemented: backup:getReminder');
  });

  registerHandler(BackupChannels.login, async () => {
    throw new Error('Not implemented: backup:login');
  });
}
