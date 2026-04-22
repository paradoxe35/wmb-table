interface PreloadedEntry {
    audio: HTMLAudioElement;
    sourceUrl: string;
    revokeOnClear: boolean;
    segmentIndex: number;
}

/**
 * TTS audio player using HTMLAudioElement for pitch-preserving speed control.
 * AudioBufferSourceNode.playbackRate shifts pitch (chipmunk effect);
 * HTMLMediaElement.preservesPitch avoids this.
 */
export class TtsAudioPlayer {
    private audio: HTMLAudioElement | null = null;
    private sourceUrl: string | null = null;
    private revokeSourceOnStop = false;
    private onEndedCb: (() => void) | null = null;
    private onErrorCb: ((err?: unknown) => void) | null = null;
    private isPlaying = false;
    private isPaused = false;
    private currentRate = 1;

    private preloadedQueue: PreloadedEntry[] = [];

    private static base64ToBlobUrl(base64: string, mimeType: string): string {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType || 'audio/mp3' });
        return URL.createObjectURL(blob);
    }

    private static resolveAudioSource(
        audioBase64: string | undefined,
        mimeType: string,
        audioUrl?: string,
    ): { url: string; revokeOnStop: boolean } {
        if (audioUrl) {
            return { url: audioUrl, revokeOnStop: false };
        }

        if (!audioBase64) {
            throw new Error('Missing TTS audio payload');
        }

        return {
            url: TtsAudioPlayer.base64ToBlobUrl(audioBase64, mimeType),
            revokeOnStop: true,
        };
    }

    async play(
        audioBase64: string | undefined,
        mimeType: string,
        rate: number = 1,
        audioUrl?: string,
    ): Promise<void> {
        this.stopSource();

        const source = TtsAudioPlayer.resolveAudioSource(audioBase64, mimeType, audioUrl);
        this.currentRate = rate;
        this.isPaused = false;
        this.playUrl(source.url, rate, source.revokeOnStop);
    }

    /**
     * Eagerly create an Audio element and pre-buffer the data so playback
     * starts instantly when the segment's turn comes.
     */
    async preload(
        audioBase64: string | undefined,
        mimeType: string,
        segmentIndex: number,
        audioUrl?: string,
    ): Promise<void> {
        if (this.preloadedQueue.some((e) => e.segmentIndex === segmentIndex)) return;

        const source = TtsAudioPlayer.resolveAudioSource(audioBase64, mimeType, audioUrl);
        const audio = new Audio(source.url);
        audio.preload = 'auto';

        // Wait for the browser to buffer enough data for instant playback
        await new Promise<void>((resolve) => {
            audio.oncanplaythrough = () => resolve();
            audio.onerror = () => resolve(); // don't block queue on decode error
            audio.load();
        });

        this.preloadedQueue.push({
            audio,
            sourceUrl: source.url,
            revokeOnClear: source.revokeOnStop,
            segmentIndex,
        });
        this.preloadedQueue.sort((a, b) => a.segmentIndex - b.segmentIndex);
    }

    hasPreloaded(): boolean {
        return this.preloadedQueue.length > 0;
    }

    hasPreloadedAtIndex(segmentIndex: number): boolean {
        return (
            this.preloadedQueue.length > 0 && this.preloadedQueue[0].segmentIndex === segmentIndex
        );
    }

    /**
     * Play the next preloaded segment. Returns its index, or -1 if empty.
     */
    playPreloaded(rate: number): number {
        if (this.preloadedQueue.length === 0) return -1;
        const entry = this.preloadedQueue.shift()!;

        this.stopSource();
        this.sourceUrl = entry.sourceUrl;
        this.revokeSourceOnStop = entry.revokeOnClear;
        this.currentRate = rate;
        this.isPaused = false;
        this.attachAndPlay(entry.audio, rate);
        return entry.segmentIndex;
    }

    clearPreloaded(): void {
        for (const entry of this.preloadedQueue) {
            if (entry.revokeOnClear) {
                URL.revokeObjectURL(entry.sourceUrl);
            }
        }
        this.preloadedQueue = [];
    }

    private playUrl(url: string, rate: number, revokeOnStop: boolean): void {
        this.revokeSourceUrl();
        this.sourceUrl = url;
        this.revokeSourceOnStop = revokeOnStop;
        const audio = new Audio(url);
        this.attachAndPlay(audio, rate);
    }

    private attachAndPlay(audio: HTMLAudioElement, rate: number): void {
        audio.preservesPitch = true;
        audio.playbackRate = rate;

        audio.onended = () => {
            if (this.isPlaying && !this.isPaused) {
                this.isPlaying = false;
                this.revokeSourceUrl();
                this.onEndedCb?.();
            }
        };

        audio.onerror = () => {
            // Guard against stale errors from a replaced audio element
            if (this.audio !== audio) return;
            console.error('TTS audio playback failed');
            this.isPlaying = false;
            this.onErrorCb?.();
        };

        this.audio = audio;
        this.isPlaying = true;
        audio.play().catch((err) => {
            // Guard: when a new play() replaces this element, stopSource() pauses
            // the old one, causing its pending play() promise to reject. Ignore
            // these stale rejections so they don't kill the new playback.
            if (this.audio !== audio) return;
            console.error('TTS audio play() failed:', err);
            this.isPlaying = false;
            this.onErrorCb?.(err);
        });
    }

    pause(): void {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;
        this.audio?.pause();
    }

    resume(): void {
        if (!this.isPaused || !this.audio) return;
        this.isPaused = false;
        this.audio.playbackRate = this.currentRate;
        this.audio.play().catch((err) => {
            console.error('TTS audio resume failed:', err);
        });
    }

    setRate(rate: number): void {
        this.currentRate = rate;
        if (this.audio) {
            this.audio.playbackRate = rate;
        }
    }

    stop(): void {
        this.stopSource();
        this.isPlaying = false;
        this.isPaused = false;
        this.clearPreloaded();
    }

    setOnEnded(cb: () => void): void {
        this.onEndedCb = cb;
    }

    setOnError(cb: (err?: unknown) => void): void {
        this.onErrorCb = cb;
    }

    dispose(): void {
        this.stop();
    }

    private stopSource(): void {
        if (this.audio) {
            this.audio.onended = null;
            this.audio.onerror = null;
            this.audio.pause();
            this.audio.removeAttribute('src');
            this.audio = null;
        }
        this.revokeSourceUrl();
    }

    private revokeSourceUrl(): void {
        if (this.sourceUrl && this.revokeSourceOnStop) {
            URL.revokeObjectURL(this.sourceUrl);
        }
        this.sourceUrl = null;
        this.revokeSourceOnStop = false;
    }
}

export const ttsAudioPlayer = new TtsAudioPlayer();

/**
 * Stop all TTS playback (audio player, browser TTS, and main process).
 * Call this before starting sermon audio to ensure mutual exclusion.
 */
export function stopAllTtsPlayback(): void {
    ttsAudioPlayer.stop();
    window.speechSynthesis?.cancel();
    window.api.tts.stopPlayback();
}
