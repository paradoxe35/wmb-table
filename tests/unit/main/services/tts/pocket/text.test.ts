import { describe, expect, it } from 'vitest';
import { prepareText } from '@main/services/tts/pocket/text';
import type { PocketBundle } from '@main/services/tts/pocket/types';

/** Token count stands in for the real tokenizer: one token per word is enough to test chunking. */
const tokenizer = {
    encode: (text: string) =>
        text
            .split(/\s+/)
            .filter(Boolean)
            .map((_, i) => i),
    decode: (ids: number[]) => ids.map(() => 'mot').join(' '),
} as never;

function bundle(): PocketBundle {
    return {
        max_token_per_chunk: 8,
        remove_semicolons: true,
        model_recommended_frames_after_eos: 8,
        flow_lm_state_manifest: [],
        mimi_state_manifest: [],
    } as unknown as PocketBundle;
}

describe('prepareText', () => {
    it('capitalises and terminates the prompt', () => {
        const { chunks } = prepareText('bonjour le monde', bundle(), tokenizer);
        expect(chunks).toEqual(['Bonjour le monde.']);
    });

    it('keeps sentences together while they fit the budget', () => {
        const { chunks } = prepareText('Un deux. Trois quatre.', bundle(), tokenizer);
        expect(chunks).toEqual(['Un deux. Trois quatre.']);
    });

    it('splits once the budget is exceeded', () => {
        const long = 'a b c d e f. g h i j k l.';
        const { chunks } = prepareText(long, bundle(), tokenizer);
        expect(chunks.length).toBeGreaterThan(1);
    });

    it('replaces semicolons when the bundle asks for it', () => {
        const { chunks } = prepareText('un; deux', bundle(), tokenizer);
        expect(chunks[0]).toContain(',');
        expect(chunks[0]).not.toContain(';');
    });

    it('uses the frame count the bundle recommends', () => {
        expect(prepareText('court', bundle(), tokenizer).framesAfterEos).toBe(8);
    });

    it('returns nothing for blank input', () => {
        expect(prepareText('   ', bundle(), tokenizer).chunks).toEqual([]);
    });
});
