import { describe, expect, it } from 'vitest';
import {
    isPlayableEntry,
    withoutRedundantHalfPrecision,
    type SherpaCatalogEntry,
} from '@main/services/tts/sherpa-catalog';

function entry(engine: string): SherpaCatalogEntry {
    return {
        engine,
        name: 'test',
        langCode: ['fr'],
        filesizeMb: 10,
        url: 'https://example.test/model.tar.bz2',
        modelName: `${engine}-test`,
    };
}

describe('isPlayableEntry', () => {
    it('offers the engines the worker builds a config for', () => {
        const engines = [
            'piper',
            'mms',
            'coqui',
            'vits',
            'kokoro',
            'matcha',
            'kitten',
            'supertonic',
        ];
        for (const engine of engines) {
            expect(isPlayableEntry(entry(engine))).toBe(true);
        }
    });

    it('withholds engines the worker cannot load, rather than failing after the download', () => {
        for (const engine of ['pocket', 'zipvoice']) {
            expect(isPlayableEntry(entry(engine))).toBe(false);
        }
    });

    it('offers an engine it has never heard of, since most are vits under another name', () => {
        expect(isPlayableEntry(entry('some-new-engine'))).toBe(true);
    });
});

describe('withoutRedundantHalfPrecision', () => {
    function build(modelName: string, name: string, engine = 'piper'): SherpaCatalogEntry {
        return {
            engine,
            name,
            langCode: ['fr'],
            filesizeMb: 10,
            url: `https://example.test/${modelName}.tar.bz2`,
            modelName,
        };
    }

    it('drops a half-precision build whose voice also ships a standard one', () => {
        const entries = [
            build('vits-piper-fr_FR-gilles-low', 'gilles'),
            build('vits-piper-fr_FR-gilles-low-fp16', 'gilles'),
        ];

        expect(withoutRedundantHalfPrecision(entries).map((e) => e.modelName)).toEqual([
            'vits-piper-fr_FR-gilles-low',
        ]);
    });

    it('keeps a half-precision build that is the only one of its voice', () => {
        const entries = [build('kitten-nano-en-v0_2-fp16', 'nano-v0_2', 'kitten')];

        expect(withoutRedundantHalfPrecision(entries)).toHaveLength(1);
    });

    it('leaves every other build alone, whatever its weights', () => {
        const entries = [
            build('vits-piper-fr_FR-tom-medium', 'tom'),
            build('vits-piper-fr_FR-tom-medium-int8', 'tom'),
        ];

        expect(withoutRedundantHalfPrecision(entries)).toHaveLength(2);
    });

    it('never mistakes an unrelated voice for a build of the same one', () => {
        // Three different icefall models are all displayed as "ljspeech".
        const entries = [
            build('matcha-icefall-en_US-ljspeech', 'ljspeech', 'icefall'),
            build('vits-icefall-en_US-ljspeech-low-fp16', 'ljspeech', 'icefall'),
        ];

        expect(withoutRedundantHalfPrecision(entries)).toHaveLength(2);
    });

    it('tells apart voices that share a name in another language', () => {
        const french = build('vits-piper-fr_FR-miro-high-fp16', 'miro');
        const portuguese = { ...build('vits-piper-pt_BR-miro-high', 'miro'), langCode: ['pt-BR'] };

        expect(withoutRedundantHalfPrecision([french, portuguese]).map((e) => e.modelName)).toEqual(
            ['vits-piper-fr_FR-miro-high-fp16', 'vits-piper-pt_BR-miro-high'],
        );
    });
});
