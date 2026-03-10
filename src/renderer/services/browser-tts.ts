export class BrowserTtsService {
    private onSegmentEnd: (() => void) | null = null;

    getVoices(): SpeechSynthesisVoice[] {
        return window.speechSynthesis.getVoices();
    }

    supportsLanguage(lang: string): boolean {
        const code = lang.split('-')[0].toLowerCase();
        return this.getVoices().some((v) => v.lang.toLowerCase().startsWith(code));
    }

    speak(
        text: string,
        voiceId: string | undefined,
        options: { rate?: number; pitch?: number; volume?: number },
    ): void {
        this.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voiceId) {
            const voice = this.getVoices().find((v) => v.voiceURI === voiceId);
            if (voice) u.voice = voice;
        }
        u.rate = options.rate ?? 1;
        u.pitch = options.pitch ?? 1;
        u.volume = options.volume ?? 1;
        u.onend = () => this.onSegmentEnd?.();
        u.onerror = (e) => console.error('Browser TTS error:', e);
        window.speechSynthesis.speak(u);
    }

    pause(): void {
        window.speechSynthesis.pause();
    }

    resume(): void {
        window.speechSynthesis.resume();
    }

    cancel(): void {
        window.speechSynthesis.cancel();
    }

    setOnSegmentEnd(cb: () => void): void {
        this.onSegmentEnd = cb;
    }
}

export const browserTts = new BrowserTtsService();
