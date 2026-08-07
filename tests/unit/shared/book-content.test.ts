import { describe, expect, it } from 'vitest';
import {
    documentContentToParagraphTexts,
    parseDocumentContent,
    serializeStructuredContent,
} from '@shared/book-content';
import { STRUCTURED_DOCUMENT_VERSION, type StructuredDocumentContent } from '@shared/types';

const structure: StructuredDocumentContent = {
    version: STRUCTURED_DOCUMENT_VERSION,
    kind: 'book',
    paragraphs: [
        {
            index: 1,
            text: 'Opening title',
            page: 12,
            pageParagraph: 1,
            chapterId: 'c1',
            heading: true,
        },
        { index: 2, text: 'First body paragraph.', page: 12, pageParagraph: 2, chapterId: 'c1' },
    ],
    pages: [{ index: 12, printed: '12', firstParagraph: 1 }],
    chapters: [{ id: 'c1', title: 'Opening title', page: 12, firstParagraph: 1, level: 1 }],
    detection: { confidence: 0.95, signals: ['running-header'], aiAssisted: false },
};

describe('book content model', () => {
    it('round-trips a structured document', () => {
        const parsed = parseDocumentContent(serializeStructuredContent(structure));

        expect(parsed.kind).toBe('book');
        expect(parsed.kind === 'book' && parsed.structure).toEqual(structure);
    });

    it('still reads a v1 paragraph array', () => {
        const parsed = parseDocumentContent(JSON.stringify(['first', 'second']));

        expect(parsed).toEqual({ kind: 'plain', paragraphs: ['first', 'second'] });
    });

    it('still reads legacy newline-joined text', () => {
        const parsed = parseDocumentContent('first\n\nsecond');

        expect(parsed).toEqual({ kind: 'plain', paragraphs: ['first', 'second'] });
    });

    it('falls back to plain text for an unknown version or malformed JSON', () => {
        expect(parseDocumentContent(JSON.stringify({ version: 99, kind: 'book' })).kind).toBe(
            'plain',
        );
        expect(parseDocumentContent('{not json at all').kind).toBe('plain');
    });

    it('never renders unreadable structure as its own JSON source', () => {
        for (const content of [
            JSON.stringify({ version: 99, kind: 'book' }),
            JSON.stringify({ ...structure, paragraphs: [] }),
        ]) {
            expect(parseDocumentContent(content)).toEqual({ kind: 'plain', paragraphs: [] });
        }
    });

    it('drops structural entries that are not usable', () => {
        const parsed = parseDocumentContent(
            JSON.stringify({
                ...structure,
                paragraphs: [{ index: 1, text: 'kept', page: 3, pageParagraph: 1 }, { text: '' }],
                chapters: [{ id: 'c1' }],
            }),
        );

        expect(parsed.kind === 'book' && parsed.structure.paragraphs).toHaveLength(1);
        expect(parsed.kind === 'book' && parsed.structure.chapters).toHaveLength(0);
    });

    it('exposes paragraph text uniformly whatever the stored shape', () => {
        expect(documentContentToParagraphTexts(serializeStructuredContent(structure))).toEqual([
            'Opening title',
            'First body paragraph.',
        ]);
        expect(documentContentToParagraphTexts('one\ntwo')).toEqual(['one', 'two']);
    });
});
