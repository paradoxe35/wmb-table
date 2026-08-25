import { describe, expect, it } from 'vitest';
import { generateAudio, type SherpaAudio } from '@main/services/tts/sherpa-generate';

const AUDIO: SherpaAudio = { samples: new Float32Array([0.1]), sampleRate: 24000 };

/** Stands in for sherpa: it rejects any language outside the set the model holds. */
function fakeTts(supported: string[] = []) {
    const calls: Array<{ sid: number; speed: number; extra?: { lang: string } }> = [];
    return {
        calls,
        generateWithConfig(
            _text: string,
            config: { sid: number; speed: number; extra?: { lang: string } },
        ) {
            calls.push(config);
            if (config.extra && !supported.includes(config.extra.lang)) {
                throw new Error('Failed to generate audio');
            }
            return AUDIO;
        },
    };
}

describe('generateAudio', () => {
    it('hands the language to the engine, so a French text is not read as English', () => {
        const tts = fakeTts(['fr', 'en']);
        expect(generateAudio(tts, 'Verset 8', 0, 1, 'fr')).toBe(AUDIO);
        expect(tts.calls).toEqual([{ sid: 0, speed: 1, extra: { lang: 'fr' } }]);
    });

    it('omits the language when there is none to send', () => {
        const tts = fakeTts();
        generateAudio(tts, 'Verse 8', 2, 1.5);
        expect(tts.calls).toEqual([{ sid: 2, speed: 1.5 }]);
    });

    it('still speaks when the model rejects the language', () => {
        const tts = fakeTts(['en']);
        expect(generateAudio(tts, 'Verset 8', 0, 1, 'fr')).toBe(AUDIO);
        expect(tts.calls).toEqual([
            { sid: 0, speed: 1, extra: { lang: 'fr' } },
            { sid: 0, speed: 1 },
        ]);
    });
});
