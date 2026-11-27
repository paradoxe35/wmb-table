import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
    buildDownloadErrorMessage,
    clearDownloadProgress,
    startDownloadProgress,
    updateDownloadProgress,
} from '@renderer/lib/download-feedback';

describe('download-feedback', () => {
    it('starts and updates tracked download progress', () => {
        const started = startDownloadProgress({}, 'fr');
        expect(started).toEqual({ fr: 0 });

        const updated = updateDownloadProgress(started, 'fr', 48);
        expect(updated).toEqual({ fr: 48 });
    });

    it('clears tracked download progress on completion or failure', () => {
        expect(clearDownloadProgress({ fr: 48, en: 100 }, 'fr')).toEqual({ en: 100 });
    });

    it('builds a translated wrapped error with fallback', () => {
        const t = ((key: string, options?: Record<string, string>) => {
            if (key === 'Le téléchargement a échoué.') {
                return 'Download failed.';
            }
            if (key === 'Erreur: {{error}}') {
                return `Error: ${options?.error ?? ''}`;
            }
            return key;
        }) as TFunction;

        expect(
            buildDownloadErrorMessage(t, new Error('network down'), 'Le téléchargement a échoué.'),
        ).toBe('Error: network down');
        expect(buildDownloadErrorMessage(t, {}, 'Le téléchargement a échoué.')).toBe(
            'Error: Download failed.',
        );
    });

    it('builds a wrapped error without a fallback message', () => {
        const t = ((key: string, options?: Record<string, string>) =>
            key === 'Erreur: {{error}}' ? `Error: ${options?.error ?? ''}` : key) as TFunction;

        expect(buildDownloadErrorMessage(t, { message: 'permission denied' })).toBe(
            'Error: permission denied',
        );
    });
});
