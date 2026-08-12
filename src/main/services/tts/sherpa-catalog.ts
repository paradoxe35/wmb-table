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
 * Engines sherpa-onnx ships but `initialize()` in sherpa.worker.ts builds no config for.
 * A voice from one of these downloads hundreds of megabytes and then fails to load, so it
 * is never offered. Keep this in step with the branches in that function.
 */
const UNSUPPORTED_ENGINES = new Set(['kitten', 'pocket', 'supertonic', 'zipvoice']);

export function isPlayableEntry(entry: SherpaCatalogEntry): boolean {
    return !UNSUPPORTED_ENGINES.has(entry.engine);
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
