import { resolveDateLocale } from '@shared/constants';
import { getLanguageDisplayName } from '@shared/tts.types';
import type {
    AudioDocumentPlayRequest,
    AvailableTranslation,
    SermonListItem,
    SermonMeta,
} from '@shared/types';

export function getTranslationLabel(
    translation: Pick<AvailableTranslation, 'translationId' | 'translationName'>,
): string {
    return translation.translationName ?? `T${translation.translationId}`;
}

/** Returns null when the sermon has no recording for this translation. */
export function toAudioPlayRequest(
    meta: SermonMeta,
    autoplay: boolean,
): AudioDocumentPlayRequest | null {
    if (!meta.audioLink) return null;

    return {
        title: meta.title,
        audioLink: meta.audioLink,
        languageLabel: getLanguageDisplayName(meta.languageCode),
        languageCode: meta.languageCode,
        sermonId: meta.sermonId,
        translationId: meta.translationId,
        translationName: meta.translationName,
        autoplay,
    };
}

export function getSermonYear(
    sermon: Pick<SermonMeta | SermonListItem, 'sermonId'>,
): string | null {
    if (!sermon.sermonId) return null;
    return '19' + sermon.sermonId.split('-')[0];
}

export function normalizeStr(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function simpleMatch(query: string, text: string): boolean {
    if (!query) return true;
    const normalized = normalizeStr(text);
    const q = normalizeStr(query);
    return normalized.includes(q);
}

export function formatSermonDate(
    dateMs: number,
    locale: string = 'en',
    fallbackLocale?: string | null,
): string {
    const d = new Date(dateMs);
    return d.toLocaleDateString(resolveDateLocale(locale, fallbackLocale), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

/** Compact `dd/MMM/yy` with the locale's abbreviated month. */
export function formatSermonDateShort(
    dateMs: number,
    locale: string = 'en',
    fallbackLocale?: string | null,
): string {
    const d = new Date(dateMs);
    const monthRaw = d.toLocaleDateString(resolveDateLocale(locale, fallbackLocale), {
        month: 'short',
        timeZone: 'UTC',
    });
    const month = (monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)).replace(/\.$/, '');
    const day = d.getUTCDate();
    const year = String(d.getUTCFullYear()).slice(-2).padStart(2, '0');
    return `${day}/${month}/${year}`;
}

export function formatShortDate(sermonId: string): string {
    if (!sermonId || !sermonId.includes('-')) return sermonId;
    const [yy, mmdd] = sermonId.split('-');
    if (!mmdd || mmdd.length < 4) return sermonId;
    const mm = mmdd.slice(0, 2);
    const dd = mmdd.slice(2, 4);
    return `${mm}/${dd}/${yy}`;
}
