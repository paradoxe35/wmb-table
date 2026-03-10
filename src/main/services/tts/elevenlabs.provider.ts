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
} from '@shared/tts.types';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

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

interface ElevenLabsVoiceResponse {
    voices: Array<{
        voice_id: string;
        name: string;
        category: string;
        labels?: Record<string, string>;
    }>;
}

export class ElevenLabsProvider implements TtsProvider {
    readonly type: TtsProviderType = 'elevenlabs';
    private apiKey = '';
    private model = 'eleven_v3';
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
            defaultModel: 'eleven_v3',
            availableModels: [...ELEVENLABS_MODELS],
            requiresApiKey: true,
            requiresModelDownload: false,
        };
    }

    supportsLanguage(langCode: string): boolean {
        const code = langCode.split('-')[0].toLowerCase();
        return SUPPORTED_LANGUAGES.includes(code);
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        if (!this.apiKey) throw new Error('ElevenLabs API key not configured');

        const model = request.model ?? this.model;
        const voiceId = request.voiceId ?? this.voiceId;

        const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text: request.text,
                model_id: model,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`ElevenLabs TTS error ${response.status}: ${errText}`);
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
            const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
                headers: { 'xi-api-key': this.apiKey },
            });

            if (!response.ok) return this.cachedVoices;

            const data = (await response.json()) as ElevenLabsVoiceResponse;
            this.cachedVoices = data.voices.map((v) => ({
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

    dispose(): void {
        log.info('ElevenLabs TTS provider disposed');
    }
}
