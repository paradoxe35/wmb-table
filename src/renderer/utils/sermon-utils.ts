import type { SermonListItem, SermonMeta } from '@shared/types';

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

export function formatSermonDate(dateMs: number, locale: string = 'en'): string {
    const d = new Date(dateMs);
    return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

export function formatShortDate(sermonId: string): string {
    if (!sermonId || !sermonId.includes('-')) return sermonId;
    const [yy, mmdd] = sermonId.split('-');
    if (!mmdd || mmdd.length < 4) return sermonId;
    const mm = mmdd.slice(0, 2);
    const dd = mmdd.slice(2, 4);
    return `${mm}/${dd}/${yy}`;
}
