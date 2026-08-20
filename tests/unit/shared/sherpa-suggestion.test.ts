import { describe, it, expect } from 'vitest';
import {
    modelSupportsLanguage,
    pickSuggestedModel,
    QUALITY_SIZE_MB,
    SUGGESTED_ENGINES,
} from '@shared/sherpa-suggestion';
import type { TtsModelInfo } from '@shared/tts.types';
import catalogue from '../../../resources/tts/sherpa-catalog.json';

interface CatalogueEntry {
    engine?: string;
    modelName: string;
    name?: string;
    langCode: string[];
    filesizeMb?: number;
}

function model(partial: Partial<TtsModelInfo> & { modelName: string }): TtsModelInfo {
    return {
        langCode: ['fr'],
        voiceName: partial.modelName,
        installed: false,
        ...partial,
    };
}

describe('modelSupportsLanguage', () => {
    it('matches on the language, ignoring region and script', () => {
        const multi = model({ modelName: 'm', langCode: ['pt-BR', 'zh-Hans'] });

        expect(modelSupportsLanguage(multi, 'pt')).toBe(true);
        expect(modelSupportsLanguage(multi, 'zh')).toBe(true);
        expect(modelSupportsLanguage(multi, 'es')).toBe(false);
    });

    it('matches nothing when no language is active', () => {
        expect(modelSupportsLanguage(model({ modelName: 'm' }), '')).toBe(false);
    });
});

describe('pickSuggestedModel', () => {
    it('offers a preferred engine over a heavier build of another engine', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'piper-fr', engine: 'piper', filesizeMb: 60 }),
                model({ modelName: 'supertonic-fr', engine: 'supertonic', filesizeMb: 122 }),
                model({ modelName: 'mms-fr', engine: 'mms', filesizeMb: 40 }),
            ],
            'fr',
        );

        expect(suggestion?.modelName).toBe('supertonic-fr');
    });

    it('offers the lighter download when both are the preferred engine', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'supertonic-big', engine: 'supertonic', filesizeMb: 122 }),
                model({ modelName: 'supertonic-small', engine: 'supertonic', filesizeMb: 80 }),
            ],
            'fr',
        );

        expect(suggestion?.modelName).toBe('supertonic-small');
    });

    it('falls back to the lightest full-quality build when no preferred engine covers it', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'piper-a', engine: 'piper', filesizeMb: 90 }),
                model({ modelName: 'piper-b', engine: 'piper', filesizeMb: 45 }),
                model({ modelName: 'tiny', engine: 'mms', filesizeMb: 12 }),
            ],
            'fr',
        );

        expect(suggestion?.modelName).toBe('piper-b');
    });

    it('offers the heaviest build when every option is a compact one', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'tiny', engine: 'mms', filesizeMb: 8 }),
                model({ modelName: 'small', engine: 'mms', filesizeMb: QUALITY_SIZE_MB - 1 }),
            ],
            'fr',
        );

        expect(suggestion?.modelName).toBe('small');
    });

    it('ignores models that do not cover the active language', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'supertonic-en', engine: 'supertonic', langCode: ['en'] }),
                model({ modelName: 'piper-sw', engine: 'piper', langCode: ['sw'], filesizeMb: 50 }),
            ],
            'sw',
        );

        expect(suggestion?.modelName).toBe('piper-sw');
    });

    it('offers nothing once a voice for that language is installed', () => {
        const suggestion = pickSuggestedModel(
            [
                model({ modelName: 'piper-fr', engine: 'piper', installed: true }),
                model({ modelName: 'supertonic-fr', engine: 'supertonic', filesizeMb: 122 }),
            ],
            'fr',
        );

        expect(suggestion).toBeUndefined();
    });

    it('offers nothing when the language has no voice at all', () => {
        expect(
            pickSuggestedModel([model({ modelName: 'fr', langCode: ['fr'] })], 'xx'),
        ).toBeUndefined();
    });

    it('offers nothing when no language is active', () => {
        expect(pickSuggestedModel([model({ modelName: 'fr' })], '')).toBeUndefined();
    });

    it('leaves the caller list unreordered', () => {
        const models = [
            model({ modelName: 'piper-fr', engine: 'piper', filesizeMb: 60 }),
            model({ modelName: 'supertonic-fr', engine: 'supertonic', filesizeMb: 122 }),
        ];
        pickSuggestedModel(models, 'fr');

        expect(models.map((m) => m.modelName)).toEqual(['piper-fr', 'supertonic-fr']);
    });
});

describe('against the bundled catalogue', () => {
    const models: TtsModelInfo[] = (catalogue as CatalogueEntry[]).map((entry) => ({
        langCode: entry.langCode,
        modelName: entry.modelName,
        voiceName: entry.name ?? entry.modelName,
        installed: false,
        engine: entry.engine,
        filesizeMb: entry.filesizeMb,
    }));

    it.each(['fr', 'en', 'es', 'pt', 'de'])('offers supertonic for %s', (langCode) => {
        expect(pickSuggestedModel(models, langCode)?.engine).toBe(SUGGESTED_ENGINES[0]);
    });

    it('still offers something for a language supertonic does not cover', () => {
        const suggestion = pickSuggestedModel(models, 'sw');

        expect(suggestion).toBeDefined();
        expect(suggestion?.engine).not.toBe(SUGGESTED_ENGINES[0]);
    });
});
