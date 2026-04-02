import { normalizeLanguageCode } from '@shared/tts.types';

// ── Types ──

export interface SherpaCatalogEntry {
    id: string;
    engine: string;
    name: string;
    langCode: string | string[];
    langName: string;
    quality: string;
    numSpeakers: number;
    filesizeMb: number;
    url: string;
    modelName: string;
}

/** Normalize langCode (string or array) to a flat array of ISO 639-1 codes. */
export function normalizeLangCodes(langCode: string | string[]): string[] {
    const codes = Array.isArray(langCode) ? langCode : [langCode];
    return codes.map(normalizeLanguageCode);
}

/** Check if a catalog entry supports a given normalized language code. */
export function entrySupportsLang(entry: SherpaCatalogEntry, code: string): boolean {
    return normalizeLangCodes(entry.langCode).includes(code);
}
