import { TtsService } from './tts.service';

let instance: TtsService | null = null;

export function getTtsService(): TtsService {
    if (!instance) {
        instance = new TtsService();
    }
    return instance;
}

export function disposeTtsService(): void {
    if (instance) {
        // Fire-and-forget: flush cache index to disk before process exits.
        // The dispose() call writes the cache index and cleans up providers.
        instance.dispose().catch(() => {});
        instance = null;
    }
}
