import { describe, expect, it } from 'vitest';
import {
    BOOK_CONFIDENCE_THRESHOLD,
    scoreBookEvidence,
    scoreDocumentOutline,
    type BookEvidence,
} from '@main/services/book/book-detection';

const typesetBook: BookEvidence = {
    pageCount: 380,
    printedCoverage: 0.97,
    runningCoverage: 0.97,
    indentCoverage: 0.96,
    blockSpacingCoverage: 0,
    chapterCount: 10,
    tocLineCount: 10,
    numberedParagraphRatio: 0.02,
};

const transcript: BookEvidence = {
    pageCount: 22,
    printedCoverage: 0,
    runningCoverage: 0.9,
    indentCoverage: 0.8,
    blockSpacingCoverage: 0,
    chapterCount: 3,
    tocLineCount: 0,
    numberedParagraphRatio: 0.6,
};

describe('book detection', () => {
    it('accepts a typeset book', () => {
        expect(scoreBookEvidence(typesetBook).isBook).toBe(true);
    });

    it('rejects a transcript even when it looks laid out', () => {
        expect(scoreBookEvidence(transcript).isBook).toBe(false);
    });

    it('cannot reach the threshold without recoverable printed page numbers', () => {
        const everythingElse = scoreBookEvidence({ ...typesetBook, printedCoverage: 0 });

        expect(everythingElse.signals).not.toContain('printed-pages');
        expect(everythingElse.confidence).toBeLessThan(BOOK_CONFIDENCE_THRESHOLD);
    });

    it('penalises inline sermon-style paragraph numbering', () => {
        const numbered = scoreBookEvidence({ ...typesetBook, numberedParagraphRatio: 0.9 });

        expect(numbered.confidence).toBeLessThan(scoreBookEvidence(typesetBook).confidence);
    });

    it('accepts a book that spaces its paragraphs instead of indenting them', () => {
        const spaced = scoreBookEvidence({
            ...typesetBook,
            indentCoverage: 0,
            blockSpacingCoverage: 0.9,
        });

        expect(spaced.signals).toContain('block-spacing');
        expect(spaced.isBook).toBe(true);
    });

    it('never counts both paragraph conventions at once', () => {
        const both = scoreBookEvidence({ ...typesetBook, blockSpacingCoverage: 0.9 });

        expect(both.signals).toContain('indent-bimodal');
        expect(both.signals).not.toContain('block-spacing');
        expect(both.confidence).toBe(scoreBookEvidence(typesetBook).confidence);
    });

    it('rejects a document that marks its paragraphs no way at all', () => {
        const unmarked = scoreBookEvidence({
            ...typesetBook,
            indentCoverage: 0,
            blockSpacingCoverage: 0,
            runningCoverage: 0,
        });

        expect(unmarked.isBook).toBe(false);
    });

    it('accepts a heading outline only when it partitions a document of some size', () => {
        expect(scoreDocumentOutline({ chapterCount: 8, paragraphCount: 400 }).isBook).toBe(true);
        expect(scoreDocumentOutline({ chapterCount: 1, paragraphCount: 400 }).isBook).toBe(false);
        expect(scoreDocumentOutline({ chapterCount: 8, paragraphCount: 4 }).isBook).toBe(false);
    });
});
