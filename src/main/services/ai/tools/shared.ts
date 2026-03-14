import * as referenceDataService from '@main/services/reference-data.service';

export function inferTranslationId(sermonId: string, languageCode: string): number {
    const translations = referenceDataService.getTraductionsForSermon(sermonId, languageCode);
    return translations[0]?.translationId ?? 0;
}
