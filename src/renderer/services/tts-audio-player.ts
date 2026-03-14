export class TtsAudioPlayer {
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private onEnded: (() => void) | null = null;
    private isPlaying = false;
    private isPaused = false;
    private pausedAt = 0;
    private startedAt = 0;
    private currentBuffer: AudioBuffer | null = null;
    private currentRate = 1;

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        return this.audioContext;
    }

    async play(audioBase64: string, _mimeType: string, rate: number = 1): Promise<void> {
        this.stopSource();

        const ctx = this.getContext();
        if (ctx.state === 'suspended') await ctx.resume();

        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        try {
            const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
            this.currentBuffer = audioBuffer;
            this.currentRate = rate;
            this.pausedAt = 0;
            this.playBuffer(audioBuffer, 0, rate);
        } catch (err) {
            console.error('TTS audio decode failed:', err);
        }
    }

    private playBuffer(buffer: AudioBuffer, offset: number, rate: number): void {
        const ctx = this.getContext();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;

        const gain = ctx.createGain();
        // Start at full volume — no fade-in needed since decodeAudioData ensures
        // the buffer is fully decoded before playback begins
        gain.gain.setValueAtTime(1, ctx.currentTime);

        source.connect(gain);
        gain.connect(ctx.destination);

        source.onended = () => {
            if (this.isPlaying && !this.isPaused) {
                this.isPlaying = false;
                this.onEnded?.();
            }
        };

        this.sourceNode = source;
        this.gainNode = gain;
        this.isPlaying = true;
        this.isPaused = false;
        this.startedAt = ctx.currentTime - offset;
        source.start(0, offset);
    }

    pause(): void {
        if (!this.isPlaying || this.isPaused) return;
        const ctx = this.getContext();
        this.pausedAt = ctx.currentTime - this.startedAt;
        this.isPaused = true;
        this.stopSource();
    }

    resume(): void {
        if (!this.isPaused || !this.currentBuffer) return;
        this.isPaused = false;
        this.playBuffer(this.currentBuffer, this.pausedAt, this.currentRate);
    }

    stop(): void {
        this.stopSource();
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedAt = 0;
        this.currentBuffer = null;
    }

    setOnEnded(cb: () => void): void {
        this.onEnded = cb;
    }

    dispose(): void {
        this.stop();
        this.audioContext?.close();
        this.audioContext = null;
    }

    private stopSource(): void {
        if (this.sourceNode) {
            this.sourceNode.onended = null;
            try {
                this.sourceNode.stop();
            } catch {
                // already stopped
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
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
