import { describe, expect, it } from 'vitest';

describe('scripts/bible-db/languages', () => {
    it('maps local two-letter codes to helloao ISO-639-3 codes when needed', async () => {
        const { mapLocalLanguageToHelloaoLanguage } =
            await import('../../../../scripts/bible-db/languages.mjs');

        expect(mapLocalLanguageToHelloaoLanguage('fr')).toBe('fra');
        expect(mapLocalLanguageToHelloaoLanguage('en')).toBe('eng');
        expect(mapLocalLanguageToHelloaoLanguage('ua')).toBe('ukr');
        expect(mapLocalLanguageToHelloaoLanguage('zh')).toBe('zho');
        expect(mapLocalLanguageToHelloaoLanguage('lug')).toBe('lug');
    });
});
