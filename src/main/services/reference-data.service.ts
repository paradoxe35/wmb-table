import * as refRepo from '../database/repositories/reference.repository';
import type { TranslationRow } from '../database/repositories/reference.repository';
import type {
    AvailableTranslation,
    RefSermon,
    SermonListItem,
    SermonListItemWithTranslations,
    SermonMeta,
    SermonTranslation,
} from '@shared/types';

type TranslationMeta = Pick<
    TranslationRow,
    | 'translator_id'
    | 'sermon_id'
    | 'title'
    | 'sermon_title'
    | 'translator_name'
    | 'sermon_date_ms'
    | 'sermon_minutes'
    | 'location_name'
    | 'city_name'
    | 'state_abbr'
>;

/**
 * Build a unique SermonMeta id from components.
 */
function makeId(langCode: string, translatorId: number, sermonId: string): string {
    return `${langCode}:${translatorId}:${sermonId}`;
}

function sermonToMeta(s: RefSermon, langCode: string, audioLink: string | null): SermonMeta {
    return {
        id: makeId(langCode, 0, s.id),
        translationId: 0,
        languageCode: langCode,
        sermonId: s.id,
        title: s.title,
        enTitle: s.title,
        audioLink,
        translationName: null,
        dateMs: s.dateMs,
        minutes: s.minutes,
        location: s.location,
        cityState: s.cityState,
    };
}

function sermonToListItem(s: RefSermon, langCode: string, hasAudio: boolean): SermonListItem {
    return {
        translationId: 0,
        languageCode: langCode,
        sermonId: s.id,
        title: s.title,
        enTitle: s.title,
        hasAudio,
        dateMs: s.dateMs,
        location: s.location,
        cityState: s.cityState,
    };
}

function translationToMeta(
    t: TranslationMeta,
    langCode: string,
    audioLink: string | null,
): SermonMeta {
    return {
        id: makeId(langCode, t.translator_id, t.sermon_id),
        translationId: t.translator_id,
        languageCode: langCode,
        sermonId: t.sermon_id,
        title: t.title,
        enTitle: t.sermon_title,
        audioLink,
        translationName: t.translator_name,
        dateMs: t.sermon_date_ms,
        minutes: t.sermon_minutes,
        location: t.location_name,
        cityState: t.city_name
            ? t.state_abbr
                ? `${t.city_name}, ${t.state_abbr}`
                : t.city_name
            : null,
    };
}

function translationToListItem(
    t: TranslationMeta,
    langCode: string,
    hasAudio: boolean,
): SermonListItem {
    return {
        translationId: t.translator_id,
        languageCode: langCode,
        sermonId: t.sermon_id,
        title: t.title,
        enTitle: t.sermon_title,
        hasAudio,
        dateMs: t.sermon_date_ms,
        location: t.location_name,
        cityState: t.city_name
            ? t.state_abbr
                ? `${t.city_name}, ${t.state_abbr}`
                : t.city_name
            : null,
    };
}

function compareSermonDateDesc(
    left: Pick<SermonListItem, 'dateMs'>,
    right: Pick<SermonListItem, 'dateMs'>,
): number {
    return right.dateMs - left.dateMs;
}

function pushGroupedByYear<T extends SermonMeta>(grouped: Record<string, T[]>, sermon: T): void {
    const year = sermon.sermonId.split('-')[0];
    if (!grouped[year]) {
        grouped[year] = [];
    }
    grouped[year].push(sermon);
}

function toAvailableTranslation(meta: {
    translationId: number;
    languageCode: string;
    title: string;
    translationName?: string | null;
}): AvailableTranslation {
    return {
        translationId: meta.translationId,
        languageCode: meta.languageCode,
        title: meta.title,
        translationName: meta.translationName ?? null,
    };
}

function sortAvailableTranslations(translations: AvailableTranslation[]): AvailableTranslation[] {
    translations.sort((left, right) => left.translationId - right.translationId);
    return translations;
}

function updatePrimaryListItem(
    current: SermonListItemWithTranslations,
    candidate: SermonListItem,
): void {
    if (candidate.translationId >= current.translationId) {
        return;
    }

    current.translationId = candidate.translationId;
    current.title = candidate.title;
    current.enTitle = candidate.enTitle;
    current.hasAudio = candidate.hasAudio;
    current.dateMs = candidate.dateMs;
    current.location = candidate.location;
    current.cityState = candidate.cityState;
}

/**
 * Get the full sermon list for a language.
 * - English (translationsSupport=false): one entry per sermon, tid=0
 * - Others: one entry per (sermon, translator) from the translation table
 */
export function getSermonListForLanguage(langCode: string): SermonMeta[] {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) return [];

    // Single batch query for all audio links in this language
    const audioMap = refRepo.getAudioMapForLanguage(langCode);

    if (!lang.translationsSupport) {
        const sermons = refRepo.getAllSermons();
        return sermons.map((s) => sermonToMeta(s, langCode, audioMap.get(s.id) ?? null));
    }

    const translations = refRepo.getTranslationsForLanguage(langCode);
    return translations.map((t) =>
        translationToMeta(t, langCode, audioMap.get(t.sermon_id) ?? null),
    );
}

/**
 * Get sermon list deduplicated by sermon, with available translations array.
 */
export function getSermonListDeduplicated(langCode: string): SermonListItemWithTranslations[] {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) {
        return [];
    }

    const audioSermonIds = refRepo.getAudioSermonIdsForLanguage(langCode);

    if (!lang.translationsSupport) {
        return refRepo
            .getAllSermons()
            .map((sermon) => {
                const meta = sermonToListItem(sermon, langCode, audioSermonIds.has(sermon.id));
                return {
                    ...meta,
                    availableTranslations: [
                        toAvailableTranslation({ ...meta, translationName: null }),
                    ],
                };
            })
            .sort(compareSermonDateDesc);
    }

    const grouped = new Map<string, SermonListItemWithTranslations>();
    for (const translation of refRepo.getTranslationsForLanguage(langCode)) {
        const meta = translationToListItem(
            translation,
            langCode,
            audioSermonIds.has(translation.sermon_id),
        );
        const existing = grouped.get(meta.sermonId);

        if (!existing) {
            grouped.set(meta.sermonId, {
                ...meta,
                availableTranslations: [
                    toAvailableTranslation({
                        translationId: meta.translationId,
                        languageCode: meta.languageCode,
                        title: meta.title,
                        translationName: translation.translator_name,
                    }),
                ],
            });
            continue;
        }

        existing.availableTranslations.push(
            toAvailableTranslation({
                translationId: meta.translationId,
                languageCode: meta.languageCode,
                title: meta.title,
                translationName: translation.translator_name,
            }),
        );
        updatePrimaryListItem(existing, meta);
    }

    const result = Array.from(grouped.values());
    for (const sermon of result) {
        sortAvailableTranslations(sermon.availableTranslations);
    }
    result.sort(compareSermonDateDesc);
    return result;
}

/**
 * Get a specific sermon meta by translator ID and language.
 */
export function getSermonMeta(
    translatorId: number,
    langCode: string,
    sermonId?: string,
): SermonMeta | null {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) return null;

    if (!lang.translationsSupport) {
        if (!sermonId) return null;
        const sermon = refRepo.getSermonById(sermonId);
        if (!sermon) return null;
        return sermonToMeta(sermon, langCode, refRepo.getAudioForSermonByIds(sermon.id, langCode));
    }

    if (!sermonId) return null;
    const row = refRepo.getTranslationByIds(translatorId, sermonId, langCode);
    if (!row) return null;
    return translationToMeta(row, langCode, refRepo.getAudioForSermonByIds(sermonId, langCode));
}

/**
 * Get all sermon list entries for a specific sermon and language.
 * Uses a targeted query instead of loading the full sermon list.
 */
export function getTranslationsForSermonInLanguage(
    sermonId: string,
    langCode: string,
): SermonMeta[] {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) return [];

    if (!lang.translationsSupport) {
        const sermon = refRepo.getSermonById(sermonId);
        if (!sermon) return [];
        return [sermonToMeta(sermon, langCode, refRepo.getAudioForSermonByIds(sermonId, langCode))];
    }

    const translations = refRepo.getTranslationsForSermonAndLanguage(sermonId, langCode);
    if (translations.length === 0) {
        return [];
    }

    // All translations share the same sermon_id — audio URL is identical, query once
    const audioLink = refRepo.getAudioForSermonByIds(sermonId, langCode);
    return translations
        .map((t) => translationToMeta(t, langCode, audioLink))
        .sort((left, right) => left.translationId - right.translationId);
}

/**
 * Get cross-language translations for a sermon, filtered to installed languages only.
 */
export function getTranslationsForSermon(
    sermonId: string,
    installedLanguages?: string[],
): SermonTranslation[] {
    const rows = refRepo.getTranslationsForSermon(sermonId);
    const installed = installedLanguages ? new Set(installedLanguages) : null;
    return rows
        .filter((r) => !installed || installed.has(r.lang_code))
        .map((r) => ({
            translationId: r.translation_id,
            languageCode: r.lang_code,
            title: r.title,
            translationName: r.translator_name,
        }));
}

/**
 * Get sermon list grouped by year.
 */
export function getSermonsByYear(langCode: string): Record<string, SermonMeta[]> {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) {
        return {};
    }

    const grouped: Record<string, SermonMeta[]> = {};
    const audioMap = refRepo.getAudioMapForLanguage(langCode);

    if (!lang.translationsSupport) {
        for (const sermon of refRepo.getAllSermons()) {
            pushGroupedByYear(
                grouped,
                sermonToMeta(sermon, langCode, audioMap.get(sermon.id) ?? null),
            );
        }
    } else {
        for (const translation of refRepo.getTranslationsForLanguage(langCode)) {
            pushGroupedByYear(
                grouped,
                translationToMeta(
                    translation,
                    langCode,
                    audioMap.get(translation.sermon_id) ?? null,
                ),
            );
        }
    }

    return grouped;
}
