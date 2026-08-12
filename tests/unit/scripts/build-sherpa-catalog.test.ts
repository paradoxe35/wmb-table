import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script, no type declarations
import {
    buildMmsEntries,
    mergeCatalog,
    summarizeChanges,
} from '../../../scripts/build-sherpa-catalog.mjs';

const MB = 1024 * 1024;

function voiceFiles(directory: string) {
    return [
        { type: 'file', path: `${directory}/model.onnx`, size: MB },
        { type: 'file', path: `${directory}/tokens.txt`, size: MB / 2 },
    ];
}

function languageRow(isoCode: string, name: string) {
    return { 'Iso Code': isoCode, 'Language Name': name };
}

describe('buildMmsEntries', () => {
    it('describes a voice with what the repository states about it', () => {
        const entries = buildMmsEntries(voiceFiles('abi'), [languageRow('abi', 'Abidji')]);

        expect(entries).toEqual([
            {
                engine: 'mms',
                name: 'Abidji',
                langCode: ['abi'],
                filesizeMb: 1.5,
                url: 'https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main/abi',
                modelName: 'mms-abi',
            },
        ]);
    });

    it('claims neither a quality tier nor a voice count, which no listing states', () => {
        const [entry] = buildMmsEntries(voiceFiles('abi'), [languageRow('abi', 'Abidji')]);

        expect(entry).not.toHaveProperty('quality');
        expect(entry).not.toHaveProperty('precision');
        expect(entry).not.toHaveProperty('numSpeakers');
    });

    it('counts only the files the app downloads, not the sample recording', () => {
        const withSample = [
            ...voiceFiles('abi'),
            { type: 'file', path: 'abi/sample.wav', size: 8 * MB },
        ];

        expect(buildMmsEntries(withSample, [])[0].filesizeMb).toBe(1.5);
    });

    it('skips a directory that is missing part of the voice', () => {
        const incomplete = [{ type: 'file', path: 'xyz/model.onnx', size: MB }];

        expect(buildMmsEntries(incomplete, [])).toEqual([]);
    });

    it('reads the language the way the app reads it off an installed model', () => {
        const files = [...voiceFiles('quc-dialect_north'), ...voiceFiles('deu')];
        const entries = buildMmsEntries(files, []);

        // `deu` folds to the two-letter code the app matches on; `quc` has none, and its
        // dialect suffix is not part of the language.
        expect(entries.map((entry) => entry.langCode)).toEqual([['de'], ['quc']]);
    });

    it('names a voice by its directory when the language table has no row for it', () => {
        expect(buildMmsEntries(voiceFiles('zzz'), [])[0].name).toBe('zzz');
    });

    it('orders voices by the name the reader sees', () => {
        const files = [...voiceFiles('ace'), ...voiceFiles('abi')];
        const languages = [languageRow('abi', 'Abidji'), languageRow('ace', 'Aceh')];

        expect(buildMmsEntries(files, languages).map((entry) => entry.name)).toEqual([
            'Abidji',
            'Aceh',
        ]);
    });
});

describe('mergeCatalog', () => {
    it('keeps a fixed order, so a rebuild only shows what really moved', () => {
        const release = [
            { modelName: 'vits-piper-fr_FR-siwis-medium' },
            { modelName: 'kokoro-en' },
        ];
        const mms = [{ modelName: 'mms-abi' }];

        expect(mergeCatalog(release, mms).map((entry) => entry.modelName)).toEqual([
            'kokoro-en',
            'vits-piper-fr_FR-siwis-medium',
            'mms-abi',
        ]);
    });
});

describe('summarizeChanges', () => {
    it('reports what a rebuild would do to the bundled catalog', () => {
        const previous = [
            { modelName: 'kept', filesizeMb: 1 },
            { modelName: 'edited', filesizeMb: 1 },
            { modelName: 'gone', filesizeMb: 1 },
        ];
        const next = [
            { modelName: 'kept', filesizeMb: 1 },
            { modelName: 'edited', filesizeMb: 2 },
            { modelName: 'fresh', filesizeMb: 1 },
        ];

        expect(summarizeChanges(previous, next)).toEqual({
            added: ['fresh'],
            removed: ['gone'],
            changed: 1,
        });
    });
});
