import { describe, expect, it } from 'vitest';
import { intlLanguageName } from '@shared/tts.types';
import { parseSherpaAsset } from '@main/services/tts/sherpa-catalog-parser';

function parse(assetName: string) {
    return parseSherpaAsset(assetName, 10 * 1024 * 1024, `https://example.test/${assetName}`);
}

function languagesOf(assetName: string): string[] {
    const entry = parse(assetName);
    if (!entry) return [];
    return Array.isArray(entry.langCode) ? entry.langCode : [entry.langCode];
}

describe('parseSherpaAsset', () => {
    it.each([
        ['vits-piper-ar_JO-kareem-low', 'piper', 'ar-JO'],
        ['vits-piper-en_GB-sweetbbak-amy', 'piper', 'en-GB'],
        ['vits-coqui-bg-cv', 'coqui', 'bg'],
        ['vits-mimic3-af_ZA-google-nwu_low', 'mimic3', 'af-ZA'],
        ['vits-mms-deu', 'mms', 'de'],
        ['vits-icefall-en_US-ljspeech-low', 'icefall', 'en-US'],
        ['matcha-icefall-zh-baker', 'icefall', 'zh'],
        ['vits-melo-tts-zh_en', 'melo', 'zh'],
        ['vits-cantonese-hf-xiaomaiiwn', 'cantonese', 'yue'],
        ['kokoro-en-v0_19', 'kokoro', 'en'],
        ['kitten-nano-en-v0_2-fp16', 'kitten', 'en'],
        ['vits-vctk', 'vctk', 'en'],
    ])('reads %s as %s / %s', (modelName, engine, language) => {
        const entry = parse(`${modelName}.tar.bz2`);

        expect(entry?.engine).toBe(engine);
        expect(languagesOf(`${modelName}.tar.bz2`)).toContain(language);
        expect(entry?.modelName).toBe(modelName);
    });

    it('keeps the model name identical to the asset, since it names the install directory', () => {
        expect(parse('vits-piper-fr_FR-siwis-medium.tar.bz2')?.modelName).toBe(
            'vits-piper-fr_FR-siwis-medium',
        );
    });

    it('records both languages of a bilingual model', () => {
        expect(languagesOf('kokoro-multi-lang-v1_1.tar.bz2')).toEqual(['en', 'zh']);
        expect(languagesOf('sherpa-onnx-pocket-tts-2026-01-26.tar.bz2')).toEqual(['en', 'zh']);
    });

    it('knows the language set of each supertonic revision', () => {
        expect(languagesOf('sherpa-onnx-supertonic-tts-int8-2026-03-06.tar.bz2')).toHaveLength(5);
        expect(languagesOf('sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2')).toHaveLength(
            31,
        );
    });

    it('names an engine it has never seen instead of calling everything vits', () => {
        expect(parse('vits-newengine-sq_AL-blerim-high.tar.bz2')?.engine).toBe('newengine');
        expect(parse('sherpa-onnx-futuretts-ja-alpha.tar.bz2')?.engine).toBe('futuretts');
        expect(parse('orpheus-tts-en-v1.tar.bz2')?.engine).toBe('orpheus');
    });

    it('finds the language of a model from an unknown engine', () => {
        expect(languagesOf('vits-newengine-sq_AL-blerim-high.tar.bz2')).toEqual(['sq-AL']);
        expect(languagesOf('sherpa-onnx-futuretts-ja-alpha.tar.bz2')).toEqual(['ja']);
    });

    it('does not mistake a name fragment for a language', () => {
        expect(languagesOf('orpheus-tts-en-v1.tar.bz2')).toEqual(['en']);
        expect(languagesOf('vits-zh-hf-abyssinvoker.tar.bz2')).toEqual(['zh']);
    });

    it('always reports languages as an array, single or multilingual', () => {
        expect(parse('vits-piper-cy_GB-gwryw-medium.tar.bz2')?.langCode).toEqual(['cy-GB']);
        expect(parse('kokoro-multi-lang-v1_1.tar.bz2')?.langCode).toEqual(['en', 'zh']);
    });

    it('keeps the region, so two voices of one language are told apart', () => {
        // pt_BR and pt_PT are the same name, language and size; without the region the
        // reader sees the same row twice.
        expect(languagesOf('vits-piper-pt_BR-miro-high.tar.bz2')).toEqual(['pt-BR']);
        expect(languagesOf('vits-piper-pt_PT-miro-high.tar.bz2')).toEqual(['pt-PT']);
        expect(intlLanguageName('pt-BR', 'fr')).toBe('portugais brésilien');
        expect(intlLanguageName('pt-PT', 'fr')).toBe('portugais européen');
    });

    it('never leaves the region in a name, having shown it as the language', () => {
        expect(parse('vits-mimic3-ne_NP-ne-google_low.tar.bz2')?.name).toBe('google_low');
        expect(parse('vits-piper-pt_BR-miro-high.tar.bz2')?.name).toBe('miro');
    });

    it('leaves naming to the interface, which knows the reader language', () => {
        expect(intlLanguageName('cy', 'en')).toBe('Welsh');
        expect(intlLanguageName('cy', 'fr')).toBe('gallois');
        expect(intlLanguageName('cy', 'sw')).toBe('Kiwelisi');
    });

    it('reads the voice tier, and omits it when the name has none', () => {
        expect(parse('vits-piper-ar_JO-kareem-low.tar.bz2')?.quality).toBe('low');
        expect(parse('vits-piper-ca_ES-upc_ona-x_low.tar.bz2')?.quality).toBe('x_low');
        expect(parse('vits-coqui-bg-cv.tar.bz2')?.quality).toBeUndefined();
    });

    it('reads the tier past a weight format, and never mistakes one for the other', () => {
        // How the weights were stored says nothing about how the voice was trained, and is
        // recorded nowhere: the download size already tells the reader what it would.
        const quantised = parse('vits-piper-ar_JO-SA_dii-high-fp16.tar.bz2');

        expect(quantised?.quality).toBe('high');
        expect(parse('kitten-nano-en-v0_2-fp16.tar.bz2')?.quality).toBeUndefined();
    });

    it('keeps a speaker name that happens to read as a language code', () => {
        // `SA_dii` parses as Sanskrit and `sam` as Samaritan Aramaic, but neither model
        // speaks those: dropping them would leave nothing to name the voice by.
        expect(parse('vits-piper-ar_JO-SA_dii-high-fp16.tar.bz2')?.name).toBe('SA_dii');
        expect(parse('vits-piper-en_US-sam-medium-int8.tar.bz2')?.name).toBe('sam');
    });

    it('never leaves a technical suffix in a name the reader sees', () => {
        const names = [
            'vits-piper-ca_ES-upc_pau-x_low-int8.tar.bz2',
            'vits-piper-fr_FR-gilles-low-fp16.tar.bz2',
            'kitten-nano-en-v0_2-fp16.tar.bz2',
        ].map((asset) => parse(asset)?.name);

        expect(names).toEqual(['upc_pau', 'gilles', 'nano-v0_2']);
    });

    it('rejects an asset whose language cannot be determined rather than guessing', () => {
        expect(parse('mystery-model-v1.tar.bz2')).toBeNull();
    });

    it('reports the download size in megabytes', () => {
        expect(parseSherpaAsset('vits-vctk.tar.bz2', 5 * 1024 * 1024, 'u')?.filesizeMb).toBe(5);
    });

    it('ignores assets that are not models', () => {
        expect(parse('espeak-ng-data.tar.bz2')).toBeNull();
        expect(parse('lexicon-zh-g2pw.txt')).toBeNull();
        expect(parse('checksum.txt')).toBeNull();
        expect(parse('sherpa-onnx-non-streaming-tts-x64-v1.9.22.exe')).toBeNull();
    });
});
