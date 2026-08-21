import { powerSaveBlocker } from 'electron';
import log from 'electron-log';
import { setExecutionRequest } from './execution-request.service';

let blockerId: number | null = null;

export function setPowerSaveBlocker(active: boolean): void {
    if (active) {
        if (blockerId !== null) return;
        blockerId = powerSaveBlocker.start('prevent-app-suspension');
        setExecutionRequest(true);
        log.info('[power-save] acquired (id=%d)', blockerId);
    } else {
        if (blockerId === null) return;
        powerSaveBlocker.stop(blockerId);
        setExecutionRequest(false);
        log.info('[power-save] released (id=%d)', blockerId);
        blockerId = null;
    }
}

export function disposePowerSaveBlocker(): void {
    setPowerSaveBlocker(false);
}
