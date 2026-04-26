import log from 'electron-log';
import pLimit from 'p-limit';
import { SimpleCache } from '@main/lib/simple-cache';
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
import { normalizeLanguageCode } from '@shared/tts.types';
import { fetchTtsWithRetry } from './network-retry';

const CARTESIA_API_BASE = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2025-04-16';

const CARTESIA_MODELS = ['sonic-3', 'sonic-2', 'sonic-turbo', 'sonic'] as const;

const SUPPORTED_LANGUAGES = [
    'en',
    'fr',
    'de',
    'es',
    'pt',
    'zh',
    'ja',
    'hi',
    'it',
    'ko',
    'nl',
    'pl',
    'ru',
    'sv',
    'tr',
    'tl',
    'bg',
    'ro',
    'ar',
    'cs',
    'el',
    'fi',
    'hr',
    'ms',
    'sk',
    'da',
    'ta',
    'uk',
    'hu',
    'no',
    'vi',
    'bn',
    'th',
    'he',
    'ka',
    'id',
    'te',
    'gu',
    'kn',
    'ml',
    'mr',
    'pa',
];

function parseCartesiaError(body: string): string | null {
    try {
        const json = JSON.parse(body);
        return json?.message ?? json?.detail ?? null;
    } catch {
        return body || null;
    }
}

function mapGender(gender: string | null): 'male' | 'female' | 'neutral' | undefined {
    if (!gender) return undefined;
    if (gender === 'masculine') return 'male';
    if (gender === 'feminine') return 'female';
    if (gender === 'gender_neutral') return 'neutral';
    return undefined;
}

interface CartesiaVoiceEntry {
    id: string;
    name: string;
    language: string;
    gender: string | null;
    is_owner: boolean;
    description?: string;
}

const voiceCache = new SimpleCache<TtsVoice[]>('cartesia-voices', 60 * 60 * 1000);
const synthesisLimit = pLimit(2);

export class CartesiaProvider implements TtsProvider {
    readonly type: TtsProviderType = 'cartesia';
    private apiKey = '';
    private model = 'sonic-3';
    private voiceId = 'ab636c8b-9960-4fb3-bb0c-b7b655fb9745'; // Erwan (default)

    private authHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            'Cartesia-Version': CARTESIA_VERSION,
        };
    }

    async getInfo(): Promise<TtsProviderInfo> {
        const voices = await this.fetchVoices();

        return {
            type: 'cartesia',
            locality: 'remote',
            displayName: 'Cartesia TTS',
            supportedLanguages: SUPPORTED_LANGUAGES,
            supportsVoiceCloning: true,
            supportsStreaming: false,
            voices,
            defaultModel: 'sonic-3',
            availableModels: [...CARTESIA_MODELS],
            requiresApiKey: true,
            requiresModelDownload: false,
        };
    }

    async checkCompatibility(langCode: string): Promise<TtsCompatibilityResult> {
        if (!this.apiKey) {
            return { supported: false, reason: 'not_configured' };
        }
        const code = normalizeLanguageCode(langCode);
        if (!SUPPORTED_LANGUAGES.includes(code)) {
            return { supported: false, reason: 'unsupported_language' };
        }
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        if (!this.apiKey) {
            throw new Error("La clé API Cartesia n'est pas configurée.");
        }

        const model = request.model ?? this.model;
        const voiceId = request.voiceId ?? this.voiceId;
        if (!voiceId) {
            throw new Error("Aucune voix Cartesia n'est sélectionnée.");
        }

        const language = normalizeLanguageCode(request.language ?? 'en');

        return synthesisLimit(() => this.doSynthesize(model, voiceId, language, request.text));
    }

    private async doSynthesize(
        model: string,
        voiceId: string,
        language: string,
        text: string,
    ): Promise<TtsSynthesizeResult> {
        const body = {
            model_id: model,
            transcript: text,
            voice: { mode: 'id', id: voiceId },
            language,
            output_format: {
                container: 'mp3',
                sample_rate: 44100,
                bit_rate: 128000,
            },
        };

        const response = await fetchTtsWithRetry(
            `${CARTESIA_API_BASE}/tts/bytes`,
            {
                method: 'POST',
                headers: {
                    ...this.authHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            },
            { label: 'Cartesia TTS synthesis' },
        );

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            const detail = parseCartesiaError(errText);
            throw new Error(detail ?? `Cartesia TTS error ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return { audioBase64, mimeType: 'audio/mpeg' };
    }

    async cloneVoice(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult> {
        if (!this.apiKey) throw new Error("La clé API Cartesia n'est pas configurée.");
        if (!request.language)
            throw new Error('La langue est requise pour cloner une voix Cartesia.');

        const audioBuffer = Buffer.from(request.audioBase64, 'base64');

        const boundary = `----CartesiaBoundary${Date.now()}`;
        const parts: Buffer[] = [];

        // Name field
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${request.name}\r\n`,
            ),
        );

        // Language field
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${request.language}\r\n`,
            ),
        );

        // Audio clip field
        parts.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="clip"; filename="voice.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
            ),
        );
        parts.push(audioBuffer);
        parts.push(Buffer.from('\r\n'));

        // Closing boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(parts);

        const response = await fetch(`${CARTESIA_API_BASE}/voices/clone`, {
            method: 'POST',
            headers: {
                ...this.authHeaders(),
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Cartesia voice clone error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as { id: string };
        if (!data.id) throw new Error('Cartesia voice clone: no voice ID in response');

        // Invalidate cache and refetch
        voiceCache.remove();
        await this.fetchVoices();

        return { voiceId: data.id };
    }

    async listClonedVoices(): Promise<TtsVoice[]> {
        const voices = await this.fetchVoices();
        return voices.filter((v) => v.isCloned);
    }

    async deleteClonedVoice(voiceId: string): Promise<void> {
        if (!this.apiKey) throw new Error("La clé API Cartesia n'est pas configurée.");

        const response = await fetch(`${CARTESIA_API_BASE}/voices/${voiceId}`, {
            method: 'DELETE',
            headers: this.authHeaders(),
        });

        if (!response.ok && response.status !== 204) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Cartesia delete voice error ${response.status}: ${errText}`);
        }

        voiceCache.remove();
    }

    async resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<Partial<TtsProviderSettings> | null> {
        const code = normalizeLanguageCode(langCode);
        const voices = await this.fetchVoices();

        // If current voice already matches language, keep it
        if (cfg?.voiceId) {
            const currentVoice = voices.find((v) => v.id === cfg.voiceId);
            if (currentVoice?.languageCodes[0] === code) return null;
        }

        const matches = voices.filter((v) => v.languageCodes[0] === code);
        if (matches.length === 0) {
            return { voiceId: '' };
        }

        const male = matches.find((v) => v.gender === 'male');
        const chosen = male ?? matches[0];
        return { voiceId: chosen.id };
    }

    private async fetchVoices(): Promise<TtsVoice[]> {
        if (!this.apiKey) {
            return voiceCache.getStale() ?? [];
        }

        return voiceCache.getOrFetch(async () => {
            const all: CartesiaVoiceEntry[] = [];
            let cursor: string | undefined;

            do {
                const url = new URL(`${CARTESIA_API_BASE}/voices`);
                url.searchParams.set('limit', '100');
                if (cursor) url.searchParams.set('starting_after', cursor);

                const response = await fetch(url.toString(), {
                    headers: this.authHeaders(),
                });

                if (!response.ok) {
                    const errBody = await response.text().catch(() => '');
                    throw new Error(
                        `Cartesia voices fetch failed (${response.status}): ${errBody}`,
                    );
                }

                const json = (await response.json()) as
                    | CartesiaVoiceEntry[]
                    | { data?: CartesiaVoiceEntry[]; has_more?: boolean };

                const voices: CartesiaVoiceEntry[] = Array.isArray(json) ? json : (json.data ?? []);
                const hasMore = Array.isArray(json) ? false : (json.has_more ?? false);

                all.push(...voices);
                cursor = hasMore && voices.length > 0 ? voices[voices.length - 1].id : undefined;
            } while (cursor);

            return all.map((v) => ({
                id: v.id,
                name: v.name,
                languageCodes: [v.language],
                gender: mapGender(v.gender),
                isCloned: v.is_owner,
            }));
        });
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
        log.info('Cartesia TTS provider disposed');
    }
}
