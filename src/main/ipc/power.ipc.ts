import { PowerChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import { setPowerSaveBlocker } from '@main/services/power-save.service';

export function registerPowerHandlers(): void {
    registerHandler(PowerChannels.setActive, async (_event, active) => {
        setPowerSaveBlocker(active);
    });
}
