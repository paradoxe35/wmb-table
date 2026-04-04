import { describe, expect, it } from 'vitest';
import {
    extractParagraphsFromPlainText,
    htmlToParagraphs,
    resolveCustomDocumentImportFormat,
} from '@main/services/custom-document-import.service';

describe('custom-document-import.service', () => {
    it('resolves supported formats from file names', () => {
        expect(resolveCustomDocumentImportFormat('notes.pdf')).toBe('pdf');
        expect(resolveCustomDocumentImportFormat('notes.txt')).toBe('txt');
        expect(resolveCustomDocumentImportFormat('notes.md')).toBe('md');
        expect(resolveCustomDocumentImportFormat('notes.docx')).toBe('docx');
        expect(resolveCustomDocumentImportFormat('notes.epub')).toBe('epub');
    });

    it('converts HTML blocks into readable paragraphs', () => {
        const paragraphs = htmlToParagraphs(`
            <h1>Title</h1>
            <p>First paragraph.</p>
            <ul><li>Bullet one</li><li>Bullet two</li></ul>
            <p>Second paragraph.</p>
        `);

        expect(paragraphs).toEqual([
            'Title',
            'First paragraph.',
            '- Bullet one',
            '- Bullet two',
            'Second paragraph.',
        ]);
    });

    it('reconstructs wrapped plain text paragraphs', () => {
        const paragraphs = extractParagraphsFromPlainText(
            'Wrapped text line one\ncontinues here.\n\nNext paragraph.',
        );

        expect(paragraphs).toEqual(['Wrapped text line one continues here.', 'Next paragraph.']);
    });
});
