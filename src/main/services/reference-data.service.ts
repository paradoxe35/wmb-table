import * as refRepo from '../database/repositories/reference.repository';
import type { SermonMeta, SermonMetaWithTraductions, SermonTranslation } from '@shared/types';

/**
 * Build a unique SermonMeta id from components.
 */
function makeId(langCode: string, translatorId: number, sermonId: string): string {
    return `${langCode}:${translatorId}:${sermonId}`;
}

/**
 * Get the full sermon list for a language.
 * - English (translationsSupport=false): one entry per sermon, tid=0
 * - Others: one entry per (sermon, translator) from the translation table
 */
export function getSermonListForLanguage(langCode: string): SermonMeta[] {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) return [];

    if (!lang.translationsSupport) {
        // English or non-translated language: direct from sermon table
        const sermons = refRepo.getAllSermons();
        return sermons.map((s) => {
            const audioLink = refRepo.getAudioForSermonByIds(s.id, langCode);
            return {
                id: makeId(langCode, 0, s.id),
                translationId: 0,
                languageCode: langCode,
                sermonId: s.id,
                title: s.title,
                enTitle: s.title,
                audioLink,
                traductionName: null,
                dateMs: s.dateMs,
                minutes: s.minutes,
                location: s.location,
                cityState: s.cityState,
            };
        });
    }

    // Translated language: from translation table with translator info
    const translations = refRepo.getTranslationsForLanguage(langCode);
    // Also get English sermons for enTitle lookup
    return translations.map((t) => {
        const audioLink = refRepo.getAudioForSermonByIds(t.sermon_id, langCode);
        return {
            id: makeId(langCode, t.translator_id, t.sermon_id),
            translationId: t.translator_id,
            languageCode: langCode,
            sermonId: t.sermon_id,
            title: t.title,
            enTitle: t.sermon_title, // sermon.title is always English
            audioLink,
            traductionName: t.translator_name,
            dateMs: t.sermon_date_ms,
            minutes: t.sermon_minutes,
            location: t.location_name,
            cityState: t.city_name
                ? t.state_abbr
                    ? `${t.city_name}, ${t.state_abbr}`
                    : t.city_name
                : null,
        };
    });
}

/**
 * Get sermon list deduplicated by sermon, with available traductions array.
 */
export function getSermonListDeduplicated(langCode: string): SermonMetaWithTraductions[] {
    const allMeta = getSermonListForLanguage(langCode);

    // Group by sermonId (= sermon.id like "53-0403")
    const groups = new Map<string, SermonMeta[]>();
    for (const meta of allMeta) {
        const existing = groups.get(meta.sermonId);
        if (existing) {
            existing.push(meta);
        } else {
            groups.set(meta.sermonId, [meta]);
        }
    }

    const result: SermonMetaWithTraductions[] = [];
    for (const [, rows] of groups) {
        // Sort by translationId to pick primary consistently (lowest first)
        rows.sort((a, b) => a.translationId - b.translationId);
        const primary = rows[0];
        const availableTraductions = rows.map((r) => ({
            translationId: r.translationId,
            traductionName: r.traductionName,
        }));
        result.push({ ...primary, availableTraductions });
    }

    // Sort by dateMs desc (most recent first)
    result.sort((a, b) => b.dateMs - a.dateMs);
    return result;
}

/**
 * Get a specific sermon meta by translator ID and language.
 * If sermonId is provided, match exactly; otherwise return first match.
 */
export function getSermonMeta(
    translatorId: number,
    langCode: string,
    sermonId?: string,
): SermonMeta | null {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) return null;

    if (!lang.translationsSupport) {
        // English: tid=0
        if (sermonId) {
            const sermon = refRepo.getSermonById(sermonId);
            if (!sermon) return null;
            const audioLink = refRepo.getAudioForSermonByIds(sermon.id, langCode);
            return {
                id: makeId(langCode, 0, sermon.id),
                translationId: 0,
                languageCode: langCode,
                sermonId: sermon.id,
                title: sermon.title,
                enTitle: sermon.title,
                audioLink,
                traductionName: null,
                dateMs: sermon.dateMs,
                minutes: sermon.minutes,
                location: sermon.location,
                cityState: sermon.cityState,
            };
        }
        return null;
    }

    // Direct single-sermon lookup for translated languages
    if (sermonId) {
        const row = refRepo.getTranslationByIds(translatorId, sermonId, langCode);
        if (!row) return null;
        const audioLink = refRepo.getAudioForSermonByIds(sermonId, langCode);
        return {
            id: makeId(langCode, row.translator_id, row.sermon_id),
            translationId: row.translator_id,
            languageCode: langCode,
            sermonId: row.sermon_id,
            title: row.title,
            enTitle: row.sermon_title,
            audioLink,
            traductionName: row.translator_name,
            dateMs: row.sermon_date_ms,
            minutes: row.sermon_minutes,
            location: row.location_name,
            cityState: row.city_name
                ? row.state_abbr
                    ? `${row.city_name}, ${row.state_abbr}`
                    : row.city_name
                : null,
        };
    }
    return null;
}

/**
 * Get all sermon list entries for a specific sermon date and language.
 */
export function getTraductionsForSermon(sermonId: string, langCode: string): SermonMeta[] {
    const allForLang = getSermonListForLanguage(langCode);
    return allForLang
        .filter((m) => m.sermonId === sermonId)
        .sort((a, b) => a.translationId - b.translationId);
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
            languageCode: r.lang_code,
            title: r.title,
            translatorName: r.translator_name,
        }));
}

/**
 * Get sermon list grouped by year.
 */
export function getSermonsByYear(langCode: string): Record<string, SermonMeta[]> {
    const all = getSermonListForLanguage(langCode);
    const grouped: Record<string, SermonMeta[]> = {};
    for (const sermon of all) {
        // sermon.sermonId is like "53-0403" — extract 2-digit year prefix
        const year = sermon.sermonId.split('-')[0];
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(sermon);
    }
    return grouped;
}
