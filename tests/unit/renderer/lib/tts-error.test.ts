import { describe, expect, it } from 'vitest';
import { getTtsPlaybackErrorMessage } from '@renderer/lib/tts-error';

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

    it('falls back to the generic provider message for unknown failures', () => {
        expect(getTtsPlaybackErrorMessage(t, new Error('Unexpected binary payload'))).toBe(
            'Audio playback failed. Check the provider configuration.',
        );
    });
});
