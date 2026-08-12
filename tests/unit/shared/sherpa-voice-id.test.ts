import { describe, expect, it } from 'vitest';
import {
    isSherpaVoiceOf,
    sherpaVoiceId,
    sherpaVoiceModel,
    sherpaVoiceSpeaker,
} from '@shared/sherpa-voice-id';

describe('sherpa voice ids', () => {
    it('names a speaker inside a model', () => {
        expect(sherpaVoiceId('vits-vctk', 42)).toBe('vits-vctk:42');
        expect(sherpaVoiceId('vits-piper-fr_FR-siwis-medium')).toBe(
            'vits-piper-fr_FR-siwis-medium:0',
        );
    });

    it('reads back what it wrote', () => {
        const id = sherpaVoiceId('vits-piper-fr_FR-tom-medium-int8', 3);

        expect(sherpaVoiceModel(id)).toBe('vits-piper-fr_FR-tom-medium-int8');
        expect(sherpaVoiceSpeaker(id)).toBe(3);
    });

    it('survives a model name that holds the separator', () => {
        const id = sherpaVoiceId('odd:name', 7);

        expect(sherpaVoiceModel(id)).toBe('odd:name');
        expect(sherpaVoiceSpeaker(id)).toBe(7);
    });

    it('treats an id with no speaker as the model itself, speaking first', () => {
        expect(sherpaVoiceModel('vits-vctk')).toBe('vits-vctk');
        expect(sherpaVoiceSpeaker('vits-vctk')).toBe(0);
    });

    it('falls back to the first speaker rather than NaN', () => {
        expect(sherpaVoiceSpeaker('model:abc')).toBe(0);
        expect(sherpaVoiceSpeaker('model:-1')).toBe(0);
        expect(sherpaVoiceSpeaker('model:')).toBe(0);
    });

    it('tells whether a voice belongs to a model, prefix alone being no proof', () => {
        expect(isSherpaVoiceOf('vits-vctk:3', 'vits-vctk')).toBe(true);
        expect(isSherpaVoiceOf('vits-vctk-low:3', 'vits-vctk')).toBe(false);
    });
});
