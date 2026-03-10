export class TtsAudioPlayer {
    private audioElement: HTMLAudioElement;
    private currentBlobUrl: string | null = null;
    private onEnded: (() => void) | null = null;

    constructor() {
        this.audioElement = new Audio();
        this.audioElement.addEventListener('ended', () => this.onEnded?.());
    }

    play(audioBase64: string, mimeType: string, rate: number = 1): void {
        this.cleanup();
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType });
        this.currentBlobUrl = URL.createObjectURL(blob);
        this.audioElement.src = this.currentBlobUrl;
        this.audioElement.playbackRate = rate;
        this.audioElement.play().catch((err) => {
            console.error('TTS audio playback failed:', err);
        });
    }

    pause(): void {
        this.audioElement.pause();
    }

    resume(): void {
        this.audioElement.play().catch((err) => {
            console.error('TTS resume failed:', err);
        });
    }

    stop(): void {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.cleanup();
    }

    setOnEnded(cb: () => void): void {
        this.onEnded = cb;
    }

    dispose(): void {
        this.stop();
    }

    private cleanup(): void {
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
    }
}

export const ttsAudioPlayer = new TtsAudioPlayer();
