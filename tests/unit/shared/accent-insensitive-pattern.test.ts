import { describe, expect, it } from 'vitest';
import { createSearchRegex } from '@tiptap/extension-find-and-replace';
import { accentInsensitivePattern, strNormalize } from '@shared/searchable';

/** Compiles through the extension's own RE2 path, the engine that runs in the editor. */
function compile(term: string, caseSensitive = false) {
    const regex = createSearchRegex(accentInsensitivePattern(term), {
        useRegex: true,
        caseSensitive,
        wholeWord: false,
    });
    expect(regex, `pattern for "${term}" failed to compile`).not.toBeNull();
    return regex!;
}

function matches(term: string, text: string): boolean {
    return compile(term).matcher(text).find();
}

/** Each pair must match in both directions, whichever side carries the diacritics. */
const EQUIVALENT: [string, string, string][] = [
    ['latin', 'Bapteme', 'Baptême'],
    ['latin', 'eglise', 'Église'],
    ['latin', 'resurrection', 'résurrection'],
    ['latin', 'temoignage', 'témoignagé'],
    ['vietnamese', 'Nguyen', 'Nguyễn'],
    ['greek', 'αγαπη', 'ἀγάπη'],
    ['greek', 'Ιησους', 'Ἰησοῦς'],
    ['cyrillic', 'Иисус', 'Иису́с'],
    ['cyrillic', 'краткии', 'кра́ткий'],
];

describe('accentInsensitivePattern', () => {
    it.each(EQUIVALENT)('matches %s "%s" against "%s" both ways', (_script, plain, accented) => {
        expect(matches(plain, accented)).toBe(true);
        expect(matches(accented, plain)).toBe(true);
    });

    it('agrees with strNormalize on what counts as the same letter', () => {
        for (const [, plain, accented] of EQUIVALENT) {
            expect(strNormalize(plain)).toBe(strNormalize(accented));
        }
    });

    it('accepts either apostrophe style', () => {
        expect(matches("l'Agneau", 'l’Agneau')).toBe(true);
        expect(matches('l’Agneau', "l'Agneau")).toBe(true);
    });

    it('treats the oe ligature and the two letters alike', () => {
        expect(matches('coeur', 'cœur')).toBe(true);
        expect(matches('cœur', 'coeur')).toBe(true);
        expect(matches('Coeur', 'Cœur')).toBe(true);
    });

    it('keeps accents from swallowing a following letter', () => {
        expect(matches('poete', 'poète')).toBe(true);
        expect(matches('moelle', 'mœlle')).toBe(true);
    });

    it('escapes regex metacharacters instead of interpreting them', () => {
        expect(matches('a.b', 'a.b')).toBe(true);
        expect(matches('a.b', 'axb')).toBe(false);
        expect(matches('(foi)', '(foi)')).toBe(true);
        expect(matches('1+1', '1+1')).toBe(true);
    });

    it('leaves scripts without combining marks untouched', () => {
        expect(matches('恩典', '恩典')).toBe(true);
        expect(matches('だ', 'だ')).toBe(true);
    });

    it('preserves case so a case-sensitive search stays case-sensitive', () => {
        const pattern = compile('Bapteme', true);
        expect(pattern.matcher('Baptême').find()).toBe(true);
        expect(pattern.matcher('baptême').find()).toBe(false);
    });

    it('returns an empty pattern for an empty term', () => {
        expect(accentInsensitivePattern('')).toBe('');
    });
});
