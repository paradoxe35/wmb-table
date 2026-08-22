import { describe, expect, it } from 'vitest';
import { splitForSynthesis } from '@main/services/tts/pocket.provider';

describe('splitForSynthesis', () => {
    it('leaves text the service handles in one piece', () => {
        const text = "L'Eternel est mon berger, je ne manquerai de rien.";
        expect(splitForSynthesis(text)).toEqual([text]);
    });

    it('cuts on sentence boundaries once the cap is passed', () => {
        const sentence = 'Le Seigneur est mon berger. ';
        const chunks = splitForSynthesis(sentence.repeat(40), 120);

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(120);
        for (const chunk of chunks) expect(chunk.endsWith('.')).toBe(true);
    });

    it('keeps every word, in order', () => {
        const text = 'Un. Deux. Trois. Quatre. Cinq. Six. Sept. Huit. Neuf. Dix.';
        expect(splitForSynthesis(text, 20).join(' ')).toBe(text);
    });

    it('cuts a sentence longer than the cap on a space, never mid-word', () => {
        const long = `${'mot '.repeat(80).trim()}.`;
        const chunks = splitForSynthesis(long, 100);

        for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
        expect(chunks.join(' ')).toBe(long);
        for (const chunk of chunks) expect(chunk.startsWith(' ')).toBe(false);
    });

    it('collapses whitespace so a paragraph break does not become a chunk', () => {
        expect(splitForSynthesis('  Un\n\n  deux   trois  ')).toEqual(['Un deux trois']);
    });

    it('returns nothing for blank text', () => {
        expect(splitForSynthesis('   \n  ')).toEqual([]);
    });
});
