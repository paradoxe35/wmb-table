import { describe, expect, it } from 'vitest';
import { DEFAULT_TTS_PROVIDER, PROVIDER_CATALOG, TTS_PROVIDER_TYPES } from '@shared/tts.types';

/**
 * Settings outlive the build that wrote them, so the stored provider is not guaranteed to be
 * one this build knows. The interface looks its metadata up by name without a guard.
 */
describe('stored provider names', () => {
    it('has metadata for every provider a build can store', () => {
        for (const type of TTS_PROVIDER_TYPES) {
            expect(PROVIDER_CATALOG[type]).toBeDefined();
            expect(PROVIDER_CATALOG[type].hint).toBeTruthy();
            expect(PROVIDER_CATALOG[type].label).toBeTruthy();
        }
    });

    it('has metadata for the fallback the repository normalises to', () => {
        expect(PROVIDER_CATALOG[DEFAULT_TTS_PROVIDER]).toBeDefined();
        expect(TTS_PROVIDER_TYPES).toContain(DEFAULT_TTS_PROVIDER);
    });

    it('does not recognise a provider that no longer exists', () => {
        expect(TTS_PROVIDER_TYPES).not.toContain('pocket_local' as never);
        expect(PROVIDER_CATALOG['pocket_local' as never]).toBeUndefined();
    });
});
