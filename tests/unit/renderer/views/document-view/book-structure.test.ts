import { describe, expect, it } from 'vitest';
import {
    buildBookCitationLink,
    parseCustomDocumentContent,
    selectCustomDocumentReader,
} from '@renderer/views/document-view/book-structure';
import { formatBookCitation, serializeStructuredContent } from '@shared/book-content';
import { STRUCTURED_DOCUMENT_VERSION, type StructuredDocumentContent } from '@shared/types';

const structure: StructuredDocumentContent = {
    version: STRUCTURED_DOCUMENT_VERSION,
    kind: 'book',
    paragraphs: [
        {
            index: 1,
            text: 'Chapter One',
            page: 1,
            pageParagraph: 1,
            chapterId: 'c1',
            heading: true,
        },
        { index: 2, text: 'First body paragraph.', page: 1, pageParagraph: 2, chapterId: 'c1' },
        { index: 3, text: 'Second page opens here.', page: 2, pageParagraph: 1, chapterId: 'c1' },
        { index: 4, text: 'A page with no printed number.', page: 3, pageParagraph: 1 },
    ],
    pages: [
        { index: 1, printed: '9', firstParagraph: 1 },
        { index: 2, printed: '10', firstParagraph: 3 },
        { index: 3, firstParagraph: 4 },
    ],
    chapters: [{ id: 'c1', title: 'Chapter One', page: 1, firstParagraph: 1, level: 1 }],
    detection: { confidence: 0.97, signals: ['running-header'], aiAssisted: false },
};

describe('custom document content model', () => {
    it('reads legacy plain text exactly as the previous reader did', () => {
        const parsed = parseCustomDocumentContent('first\n\nsecond\nthird');

        expect(parsed.book).toBeNull();
        expect(parsed.paragraphs).toEqual([
            { paragraphIndex: 1, content: 'first' },
            { paragraphIndex: 2, content: 'second' },
            { paragraphIndex: 3, content: 'third' },
        ]);
    });

    it('reads a v1 paragraph array exactly as the previous reader did', () => {
        const parsed = parseCustomDocumentContent(JSON.stringify(['alpha', 'beta']));

        expect(parsed.book).toBeNull();
        expect(parsed.paragraphs).toEqual([
            { paragraphIndex: 1, content: 'alpha' },
            { paragraphIndex: 2, content: 'beta' },
        ]);
    });

    it('numbers book paragraphs by their printed page', () => {
        const parsed = parseCustomDocumentContent(serializeStructuredContent(structure));

        expect(parsed.paragraphs).toEqual([
            { paragraphIndex: 1, content: 'Chapter One', label: '1', heading: true },
            { paragraphIndex: 2, content: 'First body paragraph.', label: '2' },
            { paragraphIndex: 3, content: 'Second page opens here.', label: '1' },
            // No printed number on that page, so the document-wide index stands in.
            { paragraphIndex: 4, content: 'A page with no printed number.', label: '4' },
        ]);
    });

    it('marks a page break at the first paragraph of every printed page', () => {
        const { book } = parseCustomDocumentContent(serializeStructuredContent(structure));

        expect([...(book?.pageBreaks.keys() ?? [])]).toEqual([1, 3]);
        expect(book?.pageBreaks.get(3)).toEqual({ paragraphIndex: 3, printedPage: '10' });
        expect(book?.chapters).toHaveLength(1);
    });

    it('cites page · paragraph, and falls back to the index without a printed page', () => {
        const { book } = parseCustomDocumentContent(serializeStructuredContent(structure));

        expect(formatBookCitation(book!.citations.get(3)!)).toBe('10 · 1');
        expect(formatBookCitation(book!.citations.get(4)!)).toBe('¶4');
    });

    it('builds a link that carries both the anchor and the citation', () => {
        const { book } = parseCustomDocumentContent(serializeStructuredContent(structure));

        expect(buildBookCitationLink('doc-1', 'Ages', book!.citations.get(3)!)).toBe(
            'wmb://book/doc-1/3/10/1/Ages',
        );
    });

    it('falls back to the plain reader when the structure cannot be read', () => {
        const parsed = parseCustomDocumentContent(JSON.stringify({ version: 99, kind: 'book' }));

        expect(parsed.book).toBeNull();
        expect(parsed.paragraphs).toEqual([]);
    });
});

describe('reader selection', () => {
    it('opens documents stored as books in the book reader', () => {
        expect(selectCustomDocumentReader('book')).toBe('book');
    });

    it('leaves every other document on the plain reader', () => {
        expect(selectCustomDocumentReader(undefined)).toBe('plain');
    });
});
