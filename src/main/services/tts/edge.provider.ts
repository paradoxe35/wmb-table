import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import log from 'electron-log';
import { EdgeTTS } from 'node-edge-tts';
import { SimpleCache } from '@main/lib/simple-cache';
import { normalizeLangCode } from './sherpa-catalog';
import type { TtsProvider } from './provider';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsCompatibilityResult,
    TtsVoice,
} from '@shared/tts.types';

// ── Voice listing ──

interface EdgeVoiceEntry {
    ShortName: string;
    Gender: string;
    Locale: string;
    FriendlyName?: string;
}

const VOICES_URL =
    'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

const voiceCache = new SimpleCache<EdgeVoiceEntry[]>('edge-tts-voices', 24 * 60 * 60 * 1000);

function edgeVoiceToTtsVoice(v: EdgeVoiceEntry): TtsVoice {
    const langCode = v.Locale.split('-')[0].toLowerCase();
    return {
        id: v.ShortName,
        name: v.FriendlyName ?? v.ShortName.replace(/Neural$/, ''),
        languageCodes: [langCode],
        gender: v.Gender.toLowerCase() === 'female' ? 'female' : 'male',
    };
}

// ── Rate conversion ──

function rateToEdgeFormat(rate: number): string {
    const pct = Math.round((rate - 1) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// ── Temp file helper ──

function tempMp3Path(): string {
    return join(tmpdir(), `edge-tts-${randomBytes(8).toString('hex')}.mp3`);
}

// ── Provider ──

export class EdgeProvider implements TtsProvider {
    readonly type: TtsProviderType = 'edge';
    private voiceId = 'fr-FR-DeniseNeural';

    private async fetchVoices(): Promise<EdgeVoiceEntry[]> {
        return voiceCache.getOrFetch(async () => {
            const res = await fetch(VOICES_URL);
            if (!res.ok) throw new Error(`Edge TTS voice list failed: ${res.status}`);
            return (await res.json()) as EdgeVoiceEntry[];
        });
    }

    async getInfo(): Promise<TtsProviderInfo> {
        const allVoices = await this.fetchVoices();
        const voices = allVoices.map(edgeVoiceToTtsVoice);

        const langSet = new Set<string>();
        for (const v of voices) {
            for (const lc of v.languageCodes) langSet.add(lc);
        }

        return {
            type: 'edge',
            locality: 'remote',
            displayName: 'Edge TTS (Microsoft)',
            supportedLanguages: [...langSet].sort(),
            supportsVoiceCloning: false,
            supportsStreaming: false,
            voices,
            defaultModel: null,
            availableModels: [],
            requiresApiKey: false,
            requiresModelDownload: false,
        };
    }

    async checkCompatibility(langCode: string): Promise<TtsCompatibilityResult> {
        const code = normalizeLangCode(langCode);
        const voices = await this.fetchVoices();
        const hasMatch = voices.some((v) => v.Locale.split('-')[0].toLowerCase() === code);
        if (!hasMatch) {
            return { supported: false, reason: 'unsupported_language' };
        }
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        const voice = request.voiceId ?? this.voiceId;
        const rate = rateToEdgeFormat(request.rate ?? 1);
        const locale = voice.split('-').slice(0, 2).join('-');

        const tts = new EdgeTTS({
            voice,
            lang: locale,
            rate,
            timeout: 30000,
        });

        const tmpPath = tempMp3Path();
        try {
            await tts.ttsPromise(request.text, tmpPath);
            const audioBuffer = await readFile(tmpPath);

            if (audioBuffer.length === 0) {
                throw new Error('Edge TTS returned no audio data');
            }

            return {
                audioBase64: audioBuffer.toString('base64'),
                mimeType: 'audio/mp3',
            };
        } finally {
            unlink(tmpPath).catch(() => {});
        }
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    async resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<Partial<TtsProviderSettings> | null> {
        const code = normalizeLangCode(langCode);

        if (cfg?.voiceId) {
            const voiceLocale = cfg.voiceId.split('-')[0].toLowerCase(); // Edge voice IDs are already ISO (e.g. fr-FR-DeniseNeural)
            if (voiceLocale === code) return null;
        }

        const voices = await this.fetchVoices();
        const matches = voices.filter((v) => v.Locale.split('-')[0].toLowerCase() === code);
        if (matches.length === 0) {
            return { voiceId: '' };
        }

        const male = matches.find((v) => v.Gender.toLowerCase() === 'male');
        const chosen = male ?? matches[0];
        return { voiceId: chosen.ShortName };
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        log.info('Edge TTS provider disposed');
    }
}
