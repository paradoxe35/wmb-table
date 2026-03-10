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

const QWEN_SYSTEM_VOICES = [
    'Cherry',
    'Serena',
    'Ethan',
    'Chelsie',
    'Momo',
    'Vivian',
    'Moon',
    'Maia',
    'Kai',
    'Nofish',
    'Bella',
    'Jennifer',
    'Ryan',
    'Katerina',
    'Aiden',
    'Eldric Sage',
    'Mia',
    'Mochi',
    'Bellona',
    'Vincent',
    'Bunny',
    'Neil',
    'Elias',
    'Arthur',
    'Nini',
    'Ebona',
    'Seren',
    'Pip',
    'Stella',
    'Bodega',
    'Sonrisa',
    'Alek',
    'Dolce',
    'Sohee',
    'Ono Anna',
    'Lenn',
    'Emilien',
    'Andre',
    'Radio Gol',
] as const;

const QWEN_MODELS = [
    'qwen3-tts-flash',
    'qwen3-tts-instruct-flash',
    'qwen3-tts-vc-2026-01-22',
    'qwen3-tts-vc-realtime-2026-01-15',
    'qwen3-tts-vd-2026-01-26',
    'qwen3-tts-flash-realtime',
] as const;

const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'ru', 'pt', 'es', 'it'];

const DEFAULT_ENDPOINT =
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

interface QwenSynthesizeResponse {
    output?: { audio?: { url?: string } };
}

interface QwenCloneResponse {
    output?: { voice?: string; target_model?: string };
}

interface QwenClonedVoiceEntry {
    voice: string;
    gmt_create: string;
    target_model: string;
}

interface QwenListVoicesResponse {
    output?: { voice_list?: QwenClonedVoiceEntry[] };
}

export class QwenProvider implements TtsProvider {
    readonly type: TtsProviderType = 'qwen';
    private apiKey = '';
    private apiEndpoint = DEFAULT_ENDPOINT;
    private model = 'qwen3-tts-flash';
    private voiceId = 'Cherry';
    private clonedVoices: TtsVoice[] = [];

    async getInfo(): Promise<TtsProviderInfo> {
        const systemVoices: TtsVoice[] = QWEN_SYSTEM_VOICES.map((v) => ({
            id: v,
            name: v,
            languageCodes: SUPPORTED_LANGUAGES,
        }));

        return {
            type: 'qwen',
            locality: 'remote',
            displayName: 'Qwen AI TTS',
            supportedLanguages: SUPPORTED_LANGUAGES,
            supportsVoiceCloning: true,
            supportsStreaming: true,
            voices: [...systemVoices, ...this.clonedVoices],
            defaultModel: 'qwen3-tts-flash',
            availableModels: [...QWEN_MODELS],
            requiresApiKey: true,
            requiresModelDownload: false,
        };
    }

    supportsLanguage(langCode: string): boolean {
        const code = langCode.split('-')[0].toLowerCase();
        return SUPPORTED_LANGUAGES.includes(code);
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        if (!this.apiKey) throw new Error('Qwen DashScope API key not configured');

        const model = request.model ?? this.model;
        const voice = request.voiceId ?? this.voiceId;

        const input: Record<string, string> = { text: request.text, voice };
        const langType = this.mapLanguageType(request.language);
        if (langType) input.language_type = langType;

        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, input }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Qwen TTS error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as QwenSynthesizeResponse;
        const audioUrl = data?.output?.audio?.url;

        if (!audioUrl) {
            throw new Error('Qwen TTS: no audio URL in response');
        }

        // Download audio from URL
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download Qwen audio: ${audioResponse.status}`);
        }

        const arrayBuffer = await audioResponse.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = audioResponse.headers.get('content-type') ?? 'audio/wav';
        const mimeType = contentType.split(';')[0].trim();

        return { audioBase64, mimeType };
    }

    async cloneVoice(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult> {
        if (!this.apiKey) throw new Error('Qwen DashScope API key not configured');

        const baseUrl = this.getCustomizationEndpoint();

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen-voice-enrollment',
                input: {
                    action: 'create',
                    target_model: request.targetModel,
                    preferred_name: request.name,
                    audio: { data: `data:audio/mpeg;base64,${request.audioBase64}` },
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Qwen voice clone error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as QwenCloneResponse;
        const voiceId = data?.output?.voice;
        const targetModel = data?.output?.target_model ?? request.targetModel;

        if (!voiceId) throw new Error('Qwen voice clone: no voice ID in response');

        // Add to local list
        this.clonedVoices.push({
            id: voiceId,
            name: request.name,
            languageCodes: SUPPORTED_LANGUAGES,
            isCloned: true,
        });

        return { voiceId, targetModel };
    }

    async listClonedVoices(): Promise<TtsVoice[]> {
        if (!this.apiKey) return this.clonedVoices;

        const baseUrl = this.getCustomizationEndpoint();

        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'qwen-voice-enrollment',
                    input: { action: 'list', page_size: 100, page_index: 0 },
                }),
            });

            if (!response.ok) return this.clonedVoices;
            const data = (await response.json()) as QwenListVoicesResponse;
            const voices = data?.output?.voice_list ?? [];

            this.clonedVoices = voices.map((v: QwenClonedVoiceEntry) => ({
                id: v.voice,
                name: v.voice,
                languageCodes: SUPPORTED_LANGUAGES,
                isCloned: true,
            }));
            return this.clonedVoices;
        } catch (err) {
            log.warn('Failed to list Qwen cloned voices:', err);
            return this.clonedVoices;
        }
    }

    async deleteClonedVoice(voiceId: string): Promise<void> {
        if (!this.apiKey) throw new Error('Qwen DashScope API key not configured');

        const baseUrl = this.getCustomizationEndpoint();

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen-voice-enrollment',
                input: { action: 'delete', voice: voiceId },
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Qwen delete voice error ${response.status}: ${errText}`);
        }

        this.clonedVoices = this.clonedVoices.filter((v) => v.id !== voiceId);
    }

    private getCustomizationEndpoint(): string {
        return this.apiEndpoint.replace(
            /\/services\/aigc\/multimodal-generation\/generation$/,
            '/services/audio/tts/customization',
        );
    }

    private mapLanguageType(langCode?: string): string | null {
        if (!langCode) return null;
        const map: Record<string, string> = {
            zh: 'Chinese',
            en: 'English',
            ja: 'Japanese',
            ko: 'Korean',
            de: 'German',
            fr: 'French',
            ru: 'Russian',
            pt: 'Portuguese',
            es: 'Spanish',
            it: 'Italian',
        };
        return map[langCode.split('-')[0].toLowerCase()] ?? null;
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.apiKey !== undefined) this.apiKey = settings.apiKey;
        if (settings.apiEndpoint) this.apiEndpoint = settings.apiEndpoint;
        if (settings.model) this.model = settings.model;
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        log.info('Qwen TTS provider disposed');
    }
}
