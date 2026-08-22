import { describe, expect, it } from 'vitest';
import { SentencePieceTokenizer } from '@main/services/tts/pocket/sentencepiece';

const SPACE = '▁';

/** A miniature unigram vocabulary: enough to exercise merging, fallback and decoding. */
const PIECES = [
    { piece: '<unk>', score: 0 },
    { piece: `${SPACE}le`, score: -1 },
    { piece: `${SPACE}berger`, score: -1 },
    { piece: `${SPACE}b`, score: -8 },
    { piece: 'er', score: -4 },
    { piece: 'g', score: -6 },
    { piece: 'e', score: -5 },
    ...Array.from({ length: 256 }, (_, byte) => ({
        piece: `<0x${byte.toString(16).toUpperCase().padStart(2, '0')}>`,
        score: -20,
    })),
];

const tokenizer = new SentencePieceTokenizer(PIECES);

describe('SentencePieceTokenizer', () => {
    it('prefers the segmentation with the best total score', () => {
        expect(tokenizer.encode('le berger')).toEqual([1, 2]);
    });

    it('round-trips what it encodes', () => {
        expect(tokenizer.decode(tokenizer.encode('le berger'))).toBe('le berger');
    });

    it('falls back to byte pieces for characters outside the vocabulary', () => {
        const ids = tokenizer.encode('le ✓');
        expect(ids.length).toBeGreaterThan(1);
        expect(tokenizer.decode(ids)).toBe('le ✓');
    });

    it('collapses runs of whitespace the way the model was trained', () => {
        expect(tokenizer.encode('le   berger')).toEqual(tokenizer.encode('le berger'));
    });

    it('returns nothing for empty input', () => {
        expect(tokenizer.encode('')).toEqual([]);
        expect(tokenizer.encode('   ')).toEqual([]);
    });
});
