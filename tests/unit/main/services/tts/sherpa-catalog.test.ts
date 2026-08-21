import { describe, it, expect } from 'vitest';
import { resolveEngineLanguage, type SherpaCatalogEntry } from '@main/services/tts/sherpa-catalog';

function entry(partial: Partial<SherpaCatalogEntry>): SherpaCatalogEntry {
    return {
        engine: 'supertonic',
        name: 'supertonic-3',
        langCode: ['en', 'fr', 'es', 'pt', 'de'],
        filesizeMb: 122,
        url: 'https://example.invalid/model.tar.bz2',
        modelName: 'sherpa-onnx-supertonic-3',
        ...partial,
    };
}

describe('resolveEngineLanguage', () => {
    it('returns the language when the model carries it', () => {
        expect(resolveEngineLanguage(entry({}), 'fr')).toBe('fr');
    });

    it('folds a regional code down to the language', () => {
        expect(resolveEngineLanguage(entry({}), 'fr-CA')).toBe('fr');
    });

    it('returns nothing for a language the model does not carry', () => {
        expect(resolveEngineLanguage(entry({}), 'sw')).toBeUndefined();
    });

    it('distinguishes the narrower supertonic build', () => {
        const older = entry({ langCode: ['en', 'ko', 'es', 'pt', 'fr'] });

        expect(resolveEngineLanguage(older, 'fr')).toBe('fr');
        expect(resolveEngineLanguage(older, 'de')).toBeUndefined();
    });

    it('resolves for multilingual kokoro too', () => {
        const kokoro = entry({ engine: 'kokoro', langCode: ['en', 'zh'] });

        expect(resolveEngineLanguage(kokoro, 'zh')).toBe('zh');
        expect(resolveEngineLanguage(kokoro, 'fr')).toBeUndefined();
    });

    it('resolves for single-language engines, which ignore the value', () => {
        for (const engine of ['piper', 'vits', 'mms', 'matcha', 'kitten', 'coqui']) {
            const single = entry({ engine, langCode: ['fr'] });

            expect(resolveEngineLanguage(single, 'fr')).toBe('fr');
            expect(resolveEngineLanguage(single, 'de')).toBeUndefined();
        }
    });

    it('returns nothing when the model or language is unknown', () => {
        expect(resolveEngineLanguage(undefined, 'fr')).toBeUndefined();
        expect(resolveEngineLanguage(entry({}), undefined)).toBeUndefined();
        expect(resolveEngineLanguage(entry({}), '')).toBeUndefined();
    });
});
