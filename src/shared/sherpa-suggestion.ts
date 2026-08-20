import { normalizeLanguageCode } from './tts.types';
import type { TtsModelInfo } from './tts.types';

/**
 * Engines offered first, best first. Supertonic sounds markedly better than the piper and
 * mms builds that dominate the catalogue, and it covers 31 languages from one download.
 * Add an engine here to promote it; anything unlisted is ranked by weight alone.
 */
export const SUGGESTED_ENGINES: readonly string[] = ['supertonic'];

/** Under this a build is a compact variant rather than a full-quality voice. */
export const QUALITY_SIZE_MB = 30;

export function modelSupportsLanguage(model: TtsModelInfo, langCode: string): boolean {
    if (!langCode) return false;
    return model.langCode.some((code) => normalizeLanguageCode(code) === langCode);
}

function enginePriority(model: TtsModelInfo): number {
    const rank = SUGGESTED_ENGINES.indexOf(model.engine ?? '');
    return rank === -1 ? SUGGESTED_ENGINES.length : rank;
}

/** Full-quality builds first, lightest of those; among compact ones the heaviest sounds best. */
function compareByWeight(a: TtsModelInfo, b: TtsModelInfo): number {
    const aMb = a.filesizeMb ?? 0;
    const bMb = b.filesizeMb ?? 0;
    const aIsFullQuality = aMb >= QUALITY_SIZE_MB;
    const bIsFullQuality = bMb >= QUALITY_SIZE_MB;

    if (aIsFullQuality !== bIsFullQuality) return aIsFullQuality ? -1 : 1;
    return aIsFullQuality ? aMb - bMb : bMb - aMb;
}

function compareSuggestions(a: TtsModelInfo, b: TtsModelInfo): number {
    return enginePriority(a) - enginePriority(b) || compareByWeight(a, b);
}

/** The voice to offer for `langCode`, or undefined when one is already installed for it. */
export function pickSuggestedModel(
    models: TtsModelInfo[],
    langCode: string,
): TtsModelInfo | undefined {
    if (!langCode) return undefined;

    const forLanguage = models.filter((model) => modelSupportsLanguage(model, langCode));
    if (forLanguage.some((model) => model.installed)) return undefined;

    return forLanguage.sort(compareSuggestions)[0];
}
