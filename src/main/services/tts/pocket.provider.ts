import type { TtsProvider } from './provider';
import type {
    TtsCompatibilityResult,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsProviderType,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsVoice,
} from '@shared/tts.types';
import { voiceLanguageCode } from '@shared/tts.types';
import { fetchWithRetry } from '@main/lib/network-retry';
import { trimWavSilence } from './silence';

const API_BASE = 'https://pocket-tts-api.kyutai.org';
const REQUEST_TIMEOUT_MS = 120_000;

/** The service exposes one endpoint per language, named in English. */
const LANGUAGES = [
    { path: 'english', code: 'en' },
    { path: 'french', code: 'fr' },
    { path: 'german', code: 'de' },
    { path: 'spanish', code: 'es' },
    { path: 'portuguese', code: 'pt' },
    { path: 'italian', code: 'it' },
] as const;

/** kyutai publishes the same voice set for every language. */
const VOICES = [
    'alba',
    'anna',
    'azelma',
    'bill_boerst',
    'caro_davy',
    'charles',
    'cosette',
    'eponine',
    'estelle',
    'eve',
    'fantine',
    'george',
    'giovanni',
    'jane',
    'javert',
    'jean',
    'juergen',
    'lola',
    'marius',
    'mary',
    'michael',
    'paul',
    'peter_yearsley',
    'rafael',
    'stuart_bell',
    'vera',
] as const;

const DEFAULT_VOICE = 'anna';
const SEPARATOR = ':';

/** A voice names the language endpoint it speaks and the voice inside it: `<language>:<voice>`. */
function pocketVoiceId(language: string, voice: string): string {
    return `${language}${SEPARATOR}${voice}`;
}

function pocketVoiceLanguage(voiceId: string): string {
    const at = voiceId.indexOf(SEPARATOR);
    return at === -1 ? '' : voiceId.slice(0, at);
}

function pocketVoiceName(voiceId: string): string {
    const at = voiceId.indexOf(SEPARATOR);
    return at === -1 ? voiceId : voiceId.slice(at + 1);
}

function languageFor(code: string): (typeof LANGUAGES)[number] | undefined {
    return LANGUAGES.find((language) => language.code === code);
}

function displayName(voice: string): string {
    return voice.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class PocketProvider implements TtsProvider {
    readonly type: TtsProviderType = 'pocket';
    readonly trimSilence = trimWavSilence;
    private voiceId = '';

    async getInfo(): Promise<TtsProviderInfo> {
        const voices: TtsVoice[] = LANGUAGES.flatMap((language) =>
            VOICES.map((voice) => ({
                id: pocketVoiceId(language.path, voice),
                name: displayName(voice),
                languageCodes: [language.code],
            })),
        );

        return {
            type: 'pocket',
            locality: 'remote',
            displayName: 'Pocket TTS (Kyutai)',
            supportedLanguages: LANGUAGES.map((language) => language.code),
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
        return languageFor(voiceLanguageCode(langCode))
            ? { supported: true }
            : { supported: false, reason: 'no_model_for_language' };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        const voiceId = request.voiceId || this.voiceId;
        const language =
            languageFor(voiceLanguageCode(request.language ?? '')) ??
            LANGUAGES.find((entry) => entry.path === pocketVoiceLanguage(voiceId));

        if (!language) {
            throw new Error('Pocket TTS ne prend pas en charge la langue de ce document.');
        }

        const form = new FormData();
        form.append('text', request.text);
        form.append('voice_url', pocketVoiceName(voiceId) || DEFAULT_VOICE);

        const response = await fetchWithRetry(
            `${API_BASE}/${language.path}/tts`,
            { method: 'POST', body: form },
            { label: 'Pocket TTS', timeoutMs: REQUEST_TIMEOUT_MS },
        );

        if (!response.ok) {
            throw new Error(await readError(response));
        }

        return {
            audioBase64: Buffer.from(await response.arrayBuffer()).toString('base64'),
            mimeType: 'audio/wav',
        };
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Partial<TtsProviderSettings> | null {
        const language = languageFor(voiceLanguageCode(langCode));
        if (!language) return { voiceId: '' };
        if (cfg?.voiceId && pocketVoiceLanguage(cfg.voiceId) === language.path) return null;

        const voice = cfg?.voiceId ? pocketVoiceName(cfg.voiceId) : DEFAULT_VOICE;
        return { voiceId: pocketVoiceId(language.path, voice) };
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        // Nothing is held open: every request is a single HTTP call.
    }
}

async function readError(response: Response): Promise<string> {
    const body = await response.text().catch(() => '');
    try {
        const detail = (JSON.parse(body) as { detail?: string }).detail;
        if (detail) return `Pocket TTS: ${detail}`;
    } catch {
        // Not JSON; the status alone is what there is to report.
    }
    return `Pocket TTS a répondu ${response.status}.`;
}
