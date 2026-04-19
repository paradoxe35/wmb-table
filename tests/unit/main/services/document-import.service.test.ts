import { describe, expect, it } from 'vitest';
import {
    extractHtmlFromImportedDocument,
    extractParagraphsFromPlainText,
    htmlToParagraphs,
    resolveDocumentImportFormat,
} from '@main/services/document-import.service';

const encoder = new TextEncoder();

describe('document-import.service', () => {
    it('resolves supported formats from file names', () => {
        expect(resolveDocumentImportFormat('notes.pdf')).toBe('pdf');
        expect(resolveDocumentImportFormat('notes.txt')).toBe('txt');
        expect(resolveDocumentImportFormat('notes.md')).toBe('md');
        expect(resolveDocumentImportFormat('notes.docx')).toBe('docx');
        expect(resolveDocumentImportFormat('notes.epub')).toBe('epub');
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

    it('converts plain text imports into paragraph HTML', async () => {
        const html = await extractHtmlFromImportedDocument({
            fileName: 'note.txt',
            mimeType: 'text/plain',
            bytes: encoder.encode('Wrapped first line\ncontinues here.\n\nSecond paragraph.'),
        });

        expect(html).toBe('<p>Wrapped first line continues here.</p>\n<p>Second paragraph.</p>');
    });

    it('preserves structural HTML for markdown imports', async () => {
        const html = await extractHtmlFromImportedDocument({
            fileName: 'outline.md',
            mimeType: 'text/markdown',
            bytes: encoder.encode('# Title\n\n- Point one\n- Point two'),
        });

        expect(html).toContain('<h1>Title</h1>');
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Point one</li>');
    });
});
