import { describe, expect, it } from 'vitest';
import { resolveSpeakerCount } from '@main/services/tts/sherpa-catalog';

describe('resolveSpeakerCount', () => {
    it('trusts the running engine over what the files declare', () => {
        expect(resolveSpeakerCount(109, 1)).toBe(109);
        expect(resolveSpeakerCount(1, 8)).toBe(1);
    });

    it('falls back to the count declared in the model metadata', () => {
        expect(resolveSpeakerCount(undefined, 904)).toBe(904);
    });

    it('offers one voice for a model that declares nothing, until the engine answers', () => {
        expect(resolveSpeakerCount(undefined, 1)).toBe(1);
    });

    it('never returns less than one voice', () => {
        expect(resolveSpeakerCount(0, 0)).toBe(1);
    });
});
