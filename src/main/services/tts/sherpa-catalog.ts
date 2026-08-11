import { normalizeLanguageCode } from '@shared/tts.types';

// ── Types ──

export interface SherpaCatalogEntry {
    id: string;
    engine: string;
    name: string;
    langCode: string[];
    quality: string;
    numSpeakers: number;
    filesizeMb: number;
    url: string;
    modelName: string;
}

/** Fold a catalog entry's codes to ISO 639-1 so they compare against app language codes. */
export function normalizeLangCodes(langCode: string[]): string[] {
    return langCode.map(normalizeLanguageCode);
}

/** Check if a catalog entry supports a given normalized language code. */
export function entrySupportsLang(entry: SherpaCatalogEntry, code: string): boolean {
    return normalizeLangCodes(entry.langCode).includes(code);
}
