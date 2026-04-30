import { useAudioStore } from '@renderer/stores/audio.store';
import { selectIsTtsPlaying, useTtsStore } from '@renderer/stores/tts.store';

let started = false;
let lastSent: boolean | null = null;
let inFlight: Promise<void> | null = null;

function isAudibleNow(): boolean {
    return (
        selectIsTtsPlaying(useTtsStore.getState()) ||
        useAudioStore.getState().currentPlay?.status === 'play'
    );
}

function sync(): void {
    if (inFlight) return;

    const desired = isAudibleNow();
    if (desired === lastSent) return;

    inFlight = (async () => {
        try {
            await window.api.power.setActive(desired);
            lastSent = desired;
        } catch (err) {
            console.warn('[power-save] setActive failed', err);
        } finally {
            inFlight = null;
            sync();
        }
    })();
}

export function startPowerSaveController(): void {
    if (started) return;
    started = true;

    useTtsStore.subscribe(sync);
    useAudioStore.subscribe(sync);
    sync();
}
