import { useAudioStore } from '@renderer/stores/audio.store';
import { selectIsTtsPlaying, useTtsStore } from '@renderer/stores/tts.store';

let started = false;
let lastSent: boolean | null = null;
let inFlight: Promise<unknown> | null = null;

function isAudibleNow(): boolean {
    return (
        selectIsTtsPlaying(useTtsStore.getState()) ||
        useAudioStore.getState().currentPlay?.status === 'play'
    );
}

function sync(): void {
    const desired = isAudibleNow();
    if (desired === lastSent) return;
    lastSent = desired;
    const send = () => window.api.power.setActive(desired).catch(() => {});
    inFlight = inFlight ? inFlight.then(send, send) : send();
}

export function startPowerSaveController(): void {
    if (started) return;
    started = true;

    lastSent = null;
    window.api.power.setActive(false).catch(() => {});

    useTtsStore.subscribe(sync);
    useAudioStore.subscribe(sync);
    sync();
}
