import log from 'electron-log';
import type { TtsProvider } from './provider';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsVoice,
    TtsVoiceCloneRequest,
    TtsVoiceCloneResult,
    TtsCompatibilityResult,
} from '@shared/tts.types';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

function parseElevenLabsError(body: string): string | null {
    try {
        const json = JSON.parse(body);
        return json?.detail?.message ?? json?.detail ?? null;
    } catch {
        return body || null;
    }
}

const ELEVENLABS_MODELS = [
    'eleven_v3',
    'eleven_flash_v2_5',
    'eleven_flash_v2',
    'eleven_turbo_v2_5',
    'eleven_turbo_v2',
    'eleven_multilingual_v2',
    'eleven_multilingual_v1',
    'eleven_english_sts_v2',
    'eleven_english_sts_v1',
] as const;

const ENGLISH_ONLY_MODELS = new Set(['eleven_english_sts_v2', 'eleven_english_sts_v1']);

const SUPPORTED_LANGUAGES = [
    'en',
    'fr',
    'de',
    'es',
    'it',
    'pt',
    'zh',
    'ja',
    'ko',
    'hi',
    'ar',
    'ru',
    'nl',
    'pl',
    'sv',
    'da',
    'no',
    'fi',
    'tr',
    'cs',
    'ro',
    'hu',
    'el',
    'he',
    'th',
    'vi',
    'id',
    'ms',
    'uk',
    'bg',
    'hr',
    'sk',
    'sl',
    'ta',
    'te',
    'bn',
    'ml',
    'fil',
    'sw',
];

interface ElevenLabsVoiceEntry {
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
}

interface ElevenLabsVoiceResponse {
    voices: ElevenLabsVoiceEntry[];
    has_more: boolean;
    next_page_token?: string;
}

export class ElevenLabsProvider implements TtsProvider {
    readonly type: TtsProviderType = 'elevenlabs';
    private apiKey = '';
    private model = 'eleven_flash_v2_5';
    private voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // Rachel (default)
    private cachedVoices: TtsVoice[] = [];

    async getInfo(): Promise<TtsProviderInfo> {
        const voices = await this.fetchVoices();

        return {
            type: 'elevenlabs',
            locality: 'remote',
            displayName: 'ElevenLabs TTS',
            supportedLanguages: SUPPORTED_LANGUAGES,
            supportsVoiceCloning: true,
            supportsStreaming: true,
            voices,
            defaultModel: 'eleven_flash_v2_5',
            availableModels: [...ELEVENLABS_MODELS],
            requiresApiKey: true,
            requiresModelDownload: false,
        };
    }

    async checkCompatibility(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<TtsCompatibilityResult> {
        if (!this.apiKey) {
            return { supported: false, reason: 'not_configured' };
        }
        const code = langCode.split('-')[0].toLowerCase();
        const model = cfg?.model ?? this.model;
        if (ENGLISH_ONLY_MODELS.has(model) && code !== 'en') {
            return { supported: false, reason: 'no_voice_for_language' };
        }
        if (!SUPPORTED_LANGUAGES.includes(code)) {
            return { supported: false, reason: 'unsupported_language' };
        }
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        if (!this.apiKey) throw new Error('ElevenLabs API key not configured');

        const model = request.model ?? this.model;
        const voiceId = request.voiceId ?? this.voiceId;

        const url = new URL(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`);
        url.searchParams.set('output_format', 'mp3_44100_128');

        const body: Record<string, unknown> = {
            text: request.text,
            model_id: model,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
            },
        };

        if (request.language) {
            body.language_code = request.language.split('-')[0].toLowerCase();
        }

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            const detail = parseElevenLabsError(errText);
            throw new Error(detail ?? `ElevenLabs TTS error ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return { audioBase64, mimeType: 'audio/mpeg' };
    }

    async cloneVoice(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult> {
        if (!this.apiKey) throw new Error('ElevenLabs API key not configured');

        const audioBuffer = Buffer.from(request.audioBase64, 'base64');

        // Build multipart form data manually
        const boundary = `----ElevenLabsBoundary${Date.now()}`;
        const parts: Buffer[] = [];

        // Name field
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${request.name}\r\n`,
            ),
        );

        // Audio file field
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="voice.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
            ),
        );
        parts.push(audioBuffer);
        parts.push(Buffer.from('\r\n'));

        // Closing boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(parts);

        const response = await fetch(`${ELEVENLABS_API_BASE}/voices/add`, {
            method: 'POST',
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`ElevenLabs voice clone error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as { voice_id: string };
        if (!data.voice_id) throw new Error('ElevenLabs voice clone: no voice ID in response');

        // Refresh cached voices
        await this.fetchVoices();

        return { voiceId: data.voice_id };
    }

    async listClonedVoices(): Promise<TtsVoice[]> {
        const voices = await this.fetchVoices();
        return voices.filter((v) => v.isCloned);
    }

    async deleteClonedVoice(voiceId: string): Promise<void> {
        if (!this.apiKey) throw new Error('ElevenLabs API key not configured');

        const response = await fetch(`${ELEVENLABS_API_BASE}/voices/${voiceId}`, {
            method: 'DELETE',
            headers: { 'xi-api-key': this.apiKey },
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`ElevenLabs delete voice error ${response.status}: ${errText}`);
        }

        this.cachedVoices = this.cachedVoices.filter((v) => v.id !== voiceId);
    }

    private async fetchVoices(): Promise<TtsVoice[]> {
        if (!this.apiKey) return this.cachedVoices;

        try {
            const all: ElevenLabsVoiceEntry[] = [];
            let pageToken: string | undefined;

            do {
                const url = new URL(`${ELEVENLABS_API_BASE.replace('/v1', '/v2')}/voices`);
                url.searchParams.set('page_size', '100');
                if (pageToken) url.searchParams.set('next_page_token', pageToken);

                const response = await fetch(url.toString(), {
                    headers: { 'xi-api-key': this.apiKey },
                });

                if (!response.ok) return this.cachedVoices;

                const data = (await response.json()) as ElevenLabsVoiceResponse;
                all.push(...data.voices);
                pageToken = data.has_more ? data.next_page_token : undefined;
            } while (pageToken);

            this.cachedVoices = all.map((v) => ({
                id: v.voice_id,
                name: v.name,
                languageCodes: SUPPORTED_LANGUAGES,
                isCloned: v.category === 'cloned',
            }));
            return this.cachedVoices;
        } catch (err) {
            log.warn('Failed to fetch ElevenLabs voices:', err);
            return this.cachedVoices;
        }
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.apiKey !== undefined) this.apiKey = settings.apiKey;
        if (settings.model) this.model = settings.model;
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    dispose(): void {
        log.info('ElevenLabs TTS provider disposed');
    }
}
