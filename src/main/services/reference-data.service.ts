import * as refRepo from '../database/repositories/reference.repository';
import type { TranslationRow } from '../database/repositories/reference.repository';
import type {
    RefSermon,
    SermonMeta,
    SermonMetaWithTranslations,
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
export function getSermonListDeduplicated(langCode: string): SermonMetaWithTranslations[] {
    const allMeta = getSermonListForLanguage(langCode);

    const groups = new Map<string, SermonMeta[]>();
    for (const meta of allMeta) {
        const existing = groups.get(meta.sermonId);
        if (existing) {
            existing.push(meta);
        } else {
            groups.set(meta.sermonId, [meta]);
        }
    }

    const result: SermonMetaWithTranslations[] = [];
    for (const [, rows] of groups) {
        rows.sort((a, b) => a.translationId - b.translationId);
        const primary = rows[0];
        const availableTranslations = rows.map((r) => ({
            translationId: r.translationId,
            languageCode: r.languageCode,
            title: r.title,
            translationName: r.translationName,
        }));
        result.push({ ...primary, availableTranslations });
    }

    result.sort((a, b) => b.dateMs - a.dateMs);
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
    return translations.map((t) => translationToMeta(t, langCode, audioLink));
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
    const all = getSermonListForLanguage(langCode);
    const grouped: Record<string, SermonMeta[]> = {};
    for (const sermon of all) {
        const year = sermon.sermonId.split('-')[0];
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(sermon);
    }
    return grouped;
}
