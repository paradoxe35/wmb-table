import { describe, expect, it } from 'vitest';
import {
    clonedIdOf,
    clonedVoiceName,
    pocketVoiceBundle,
    pocketVoiceId,
    pocketVoiceName,
    referenceIdOf,
    referenceVoiceName,
} from '@shared/pocket-voice-id';

describe('pocket voice ids', () => {
    it('keeps the bundle and the voice separable', () => {
        const id = pocketVoiceId('french_24l', 'estelle');
        expect(pocketVoiceBundle(id)).toBe('french_24l');
        expect(pocketVoiceName(id)).toBe('estelle');
    });

    it('survives a voice name containing the separator', () => {
        const id = pocketVoiceId('french_24l', referenceVoiceName('francois_lepicard'));
        expect(pocketVoiceBundle(id)).toBe('french_24l');
        expect(referenceIdOf(pocketVoiceName(id))).toBe('francois_lepicard');
    });

    it('tells the three kinds of voice apart', () => {
        expect(referenceIdOf('estelle')).toBeNull();
        expect(clonedIdOf('estelle')).toBeNull();
        expect(clonedIdOf(clonedVoiceName('papa'))).toBe('papa');
        expect(referenceIdOf(clonedVoiceName('papa'))).toBeNull();
    });
});
