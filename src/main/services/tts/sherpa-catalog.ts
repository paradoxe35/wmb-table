import { normalizeLanguageCode } from '@shared/tts.types';
import type { TtsVoiceQuality } from '@shared/tts.types';

// ── Types ──

export interface SherpaCatalogEntry {
    engine: string;
    name: string;
    langCode: string[];
    quality?: TtsVoiceQuality;
    filesizeMb: number;
    url: string;
    modelName: string;
}

/**
 * Zero-shot cloning engines: they load and speak, but only when handed a recording of the
 * voice to imitate, which this app never asks a reader for. ZipVoice also wants a vocoder
 * from a second release and the transcript of that recording. Offering them would download
 * hundreds of megabytes for a voice that cannot say a word on its own.
 */
const UNSUPPORTED_ENGINES = new Set(['pocket', 'zipvoice']);

export function isPlayableEntry(entry: SherpaCatalogEntry): boolean {
    return !UNSUPPORTED_ENGINES.has(entry.engine);
}

function isHalfPrecision(entry: SherpaCatalogEntry): boolean {
    return entry.modelName.endsWith('-fp16');
}

function voiceKey(entry: SherpaCatalogEntry): string {
    return `${entry.engine}|${entry.name}|${entry.langCode.join(',')}`;
}

/**
 * sherpa's runtime refuses most half-precision builds — `vits-piper-fr_FR-gilles-low-fp16`
 * throws where its standard twin plays — and they only repeat a voice already listed, more
 * lightly. One with no standard twin stays: it is the only way to reach that voice.
 */
export function withoutRedundantHalfPrecision(entries: SherpaCatalogEntry[]): SherpaCatalogEntry[] {
    const standard = new Set(entries.filter((entry) => !isHalfPrecision(entry)).map(voiceKey));

    return entries.filter((entry) => !isHalfPrecision(entry) || !standard.has(voiceKey(entry)));
}

/** Fold a catalog entry's codes to ISO 639-1 so they compare against app language codes. */
export function normalizeLangCodes(langCode: string[]): string[] {
    return langCode.map(normalizeLanguageCode);
}

/** Check if a catalog entry supports a given normalized language code. */
export function entrySupportsLang(entry: SherpaCatalogEntry, code: string): boolean {
    return normalizeLangCodes(entry.langCode).includes(code);
}

/**
 * How many voices a model offers.
 *
 * `learned` is what the loaded engine answered and is exact; it is asked for as soon as a
 * model is installed. `modelSpeakers` is the count declared in a piper-style `.onnx.json`,
 * which many models do not ship. Nothing else can know: a download URL carries no speaker
 * count, so neither the bundled nor the refreshed catalog is allowed to claim one.
 */
export function resolveSpeakerCount(learned: number | undefined, modelSpeakers: number): number {
    if (learned && learned > 0) return learned;
    return Math.max(modelSpeakers, 1);
}
