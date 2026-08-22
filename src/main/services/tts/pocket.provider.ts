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
import { decodeWav, encodeWav } from './wav';

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

/**
 * The service degrades on long input rather than refusing it: a 1500-character request came
 * back missing its closing sentence entirely, while 350 to 450 characters read through. Text
 * is cut on sentence boundaries and the pieces are joined back into one clip.
 */
const MAX_CHUNK_CHARS = 350;
const CHUNK_GAP_SECONDS = 0.15;
const SENTENCE = /[^.!?…]+[.!?…]+|[^.!?…]+$/g;
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

        const voice = pocketVoiceName(voiceId) || DEFAULT_VOICE;
        const chunks = splitForSynthesis(request.text);
        if (chunks.length === 0) {
            throw new Error('Aucun texte à lire.');
        }

        const clips: Buffer[] = [];
        for (const chunk of chunks) {
            clips.push(await this.speak(language.path, voice, chunk));
        }

        return {
            audioBase64: joinClips(clips).toString('base64'),
            mimeType: 'audio/wav',
        };
    }

    private async speak(language: string, voice: string, text: string): Promise<Buffer> {
        const form = new FormData();
        form.append('text', text);
        form.append('voice_url', voice);

        const response = await fetchWithRetry(
            `${API_BASE}/${language}/tts`,
            { method: 'POST', body: form },
            { label: 'Pocket TTS', timeoutMs: REQUEST_TIMEOUT_MS },
        );

        if (!response.ok) {
            throw new Error(await readError(response));
        }
        return Buffer.from(await response.arrayBuffer());
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

/** Sentence boundaries first; a sentence longer than the cap is cut on its last space. */
export function splitForSynthesis(text: string, limit = MAX_CHUNK_CHARS): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (normalized.length <= limit) return [normalized];

    const chunks: string[] = [];
    let pending = '';

    const flush = () => {
        if (pending.trim()) chunks.push(pending.trim());
        pending = '';
    };

    for (const sentence of normalized.match(SENTENCE) ?? [normalized]) {
        const piece = sentence.trim();
        if (!piece) continue;

        if (piece.length > limit) {
            flush();
            chunks.push(...cutOnSpaces(piece, limit));
            continue;
        }

        if (!pending) pending = piece;
        else if (`${pending} ${piece}`.length <= limit) pending = `${pending} ${piece}`;
        else {
            flush();
            pending = piece;
        }
    }
    flush();

    return chunks;
}

function cutOnSpaces(sentence: string, limit: number): string[] {
    const pieces: string[] = [];
    let rest = sentence;

    while (rest.length > limit) {
        const window = rest.slice(0, limit);
        const at = window.lastIndexOf(' ');
        const cut = at > limit / 2 ? at : limit;
        pieces.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);

    return pieces;
}

/** Joins the clips into one, with a short gap so the seams do not sound clipped. */
function joinClips(clips: Buffer[]): Buffer {
    if (clips.length === 1) return clips[0];

    const decoded = clips.map(decodeWav);
    const first = decoded.find((clip) => clip !== null);
    if (!first) return clips[0];

    const sampleRate = first.sampleRate;
    const gap = new Float32Array(Math.round(CHUNK_GAP_SECONDS * sampleRate));
    const parts: Float32Array[] = [];

    decoded.forEach((clip, index) => {
        if (!clip) return;
        if (index > 0) parts.push(gap);
        parts.push(clip.samples);
    });

    const merged = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        merged.set(part, offset);
        offset += part.length;
    }

    return encodeWav(merged, sampleRate);
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
