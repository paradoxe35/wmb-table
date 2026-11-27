import type { TFunction } from 'i18next';
import { getErrorMessage } from '@renderer/utils/functions';

export function startDownloadProgress(
    progress: Record<string, number>,
    key: string,
): Record<string, number> {
    return { ...progress, [key]: 0 };
}

export function updateDownloadProgress(
    progress: Record<string, number>,
    key: string,
    percentage: number,
): Record<string, number> {
    return { ...progress, [key]: percentage };
}

export function clearDownloadProgress(
    progress: Record<string, number>,
    key: string,
): Record<string, number> {
    const next = { ...progress };
    delete next[key];
    return next;
}

export function buildDownloadErrorMessage(
    t: TFunction,
    error: unknown,
    fallbackKey?: string,
): string {
    const fallback = fallbackKey ? t(fallbackKey) : undefined;
    return t('Erreur: {{error}}', {
        error: getErrorMessage(error, fallback),
    });
}
