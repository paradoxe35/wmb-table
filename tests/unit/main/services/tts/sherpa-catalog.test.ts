import { describe, expect, it } from 'vitest';
import { isPlayableEntry, type SherpaCatalogEntry } from '@main/services/tts/sherpa-catalog';

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
