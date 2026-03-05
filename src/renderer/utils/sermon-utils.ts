import type { SermonMeta } from '@shared/types';

export function getSermonYear(sermon: SermonMeta): string | null {
    if (!sermon.sermonDate) return null;
    return '19' + sermon.sermonDate.split('-')[0];
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

export function formatSermonDate(dateMs: number): string {
    const d = new Date(dateMs);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}
