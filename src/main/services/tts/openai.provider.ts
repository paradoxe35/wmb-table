import log from 'electron-log';
import type { TtsProvider } from './provider';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsCompatibilityResult,
} from '@shared/tts.types';
import { voiceLanguageCode } from '@shared/tts.types';
import { fetchWithRetry } from '@main/lib/network-retry';
import { trimMp3Silence } from './silence';

const OPENAI_VOICES = [
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'nova',
    'onyx',
    'sage',
    'shimmer',
    'verse',
    'marin',
    'cedar',
] as const;

const OPENAI_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'] as const;

// OpenAI TTS supports 50+ languages (Whisper coverage)
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
    'lt',
    'lv',
    'et',
    'sr',
    'mk',
    'sw',
    'ta',
    'te',
    'bn',
    'ur',
    'ml',
    'kn',
    'gu',
    'mr',
    'pa',
    'af',
];

export class OpenAiProvider implements TtsProvider {
    readonly type: TtsProviderType = 'openai';
    readonly trimSilence = trimMp3Silence;
    private apiKey = '';
    private model = 'gpt-4o-mini-tts';
    private voiceId = 'nova';

    async getInfo(): Promise<TtsProviderInfo> {
        return {
            type: 'openai',
            locality: 'remote',
            displayName: 'OpenAI TTS',
            supportedLanguages: SUPPORTED_LANGUAGES,
            supportsVoiceCloning: false,
            supportsStreaming: true,
            voices: OPENAI_VOICES.map((v) => ({
                id: v,
                name: v.charAt(0).toUpperCase() + v.slice(1),
                languageCodes: SUPPORTED_LANGUAGES,
            })),
            defaultModel: 'gpt-4o-mini-tts',
            availableModels: [...OPENAI_MODELS],
            requiresApiKey: true,
            requiresModelDownload: false,
        };
    }

    async checkCompatibility(langCode: string): Promise<TtsCompatibilityResult> {
        if (!this.apiKey) {
            return { supported: false, reason: 'not_configured' };
        }
        const code = voiceLanguageCode(langCode);
        if (!SUPPORTED_LANGUAGES.includes(code)) {
            return { supported: false, reason: 'unsupported_language' };
        }
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        if (!this.apiKey) throw new Error("La clé API OpenAI n'est pas configurée.");

        const model = request.model ?? this.model;
        const voice = request.voiceId ?? this.voiceId;
        const speed = request.rate ?? 1;

        const response = await fetchWithRetry(
            'https://api.openai.com/v1/audio/speech',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    input: request.text,
                    voice,
                    response_format: 'mp3',
                    speed: Math.max(0.25, Math.min(4.0, speed)),
                }),
            },
            { label: 'OpenAI TTS synthesis' },
        );

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`OpenAI TTS error ${response.status}: ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return { audioBase64, mimeType: 'audio/mp3' };
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
        log.info('OpenAI TTS provider disposed');
    }
}
