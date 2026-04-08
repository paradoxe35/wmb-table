import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';

export function inferTranslationId(sermonId: string, languageCode: string): number | undefined {
    const translations = referenceDataService.getTranslationsForSermonInLanguage(
        sermonId,
        languageCode,
    );
    return translations[0]?.translationId;
}

export function validateLanguage(lang: string): { error: string } | null {
    const installed = tantivyService.getInstalledLanguages();
    if (installed.includes(lang)) return null;
    return {
        error: `Language "${lang}" is not installed. Available languages: ${installed.join(', ')}.`,
    };
}
