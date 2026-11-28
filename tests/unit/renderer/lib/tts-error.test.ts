import { describe, expect, it } from 'vitest';
import { getTtsPlaybackErrorMessage } from '@renderer/lib/tts-error';
import en from '@shared/i18n/locales/en';

const t = (key: string) =>
    (
        ({
            'Connexion internet indisponible. Vérifiez votre connexion et réessayez.':
                'No internet connection. Check your connection and try again.',
            'La lecture audio a échoué. Vérifiez la configuration du fournisseur.':
                'Audio playback failed. Check the provider configuration.',
            "La clé API OpenAI n'est pas configurée.": 'OpenAI API key is not configured.',
        }) as Record<string, string>
    )[key] ?? key;

describe('getTtsPlaybackErrorMessage', () => {
    it('maps network failures to an internet connectivity message', () => {
        expect(getTtsPlaybackErrorMessage(t, new Error('fetch failed'))).toBe(
            'No internet connection. Check your connection and try again.',
        );
        expect(
            getTtsPlaybackErrorMessage(
                t,
                new Error('Error invoking remote method tts:startPlayback: getaddrinfo ENOTFOUND'),
            ),
        ).toBe('No internet connection. Check your connection and try again.');
    });

    it('passes through known user-facing provider errors', () => {
        expect(
            getTtsPlaybackErrorMessage(t, new Error("La clé API OpenAI n'est pas configurée.")),
        ).toBe('OpenAI API key is not configured.');
    });

    it('tells the reader Edge is busy instead of blaming their settings', () => {
        const busy =
            'Le service de voix Edge est momentanément surchargé. Réessayez dans un instant.';
        expect(getTtsPlaybackErrorMessage(t, new Error(busy))).toBe(busy);
        expect(
            getTtsPlaybackErrorMessage(
                (key: string) => en[key as keyof typeof en] ?? key,
                new Error(busy),
            ),
        ).toBe('The Edge voice service is busy right now. Try again in a moment.');
    });

    it('falls back to the generic provider message for unknown failures', () => {
        expect(getTtsPlaybackErrorMessage(t, new Error('Unexpected binary payload'))).toBe(
            'Audio playback failed. Check the provider configuration.',
        );
    });
});
