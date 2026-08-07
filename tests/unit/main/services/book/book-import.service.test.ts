import { describe, expect, it } from 'vitest';
import { buildImportedDocumentContent } from '@main/services/book/book-import.service';
import { parseDocumentContent } from '@shared/book-content';

const encoder = new TextEncoder();

function markdown(fileName: string, text: string) {
    return { fileName, mimeType: 'text/markdown', bytes: encoder.encode(text) };
}

const outline = ['# One', 'Body of one.', '# Two', 'Body of two.', '# Three', 'Body of three.']
    .concat(Array.from({ length: 20 }, (_, index) => `Paragraph ${index + 1}.`))
    .join('\n\n');

describe('imported document content', () => {
    it('keeps a document with no heading structure on the plain path', async () => {
        const imported = await buildImportedDocumentContent(markdown('notes.md', 'Just a note.'));

        expect(imported.kind).toBeNull();
        expect(imported.content).toBe('Just a note.');
    });

    it('stores a heading outline as a book', async () => {
        const imported = await buildImportedDocumentContent(markdown('book.md', outline));
        const parsed = parseDocumentContent(imported.content);

        expect(imported.kind).toBe('book');
        expect(parsed.kind === 'book' && parsed.structure.chapters).toHaveLength(3);
    });

    it('never stores an empty structure, even when the user forces the book path', async () => {
        const imported = await buildImportedDocumentContent(markdown('empty.md', '   \n\n  '), {
            structure: 'book',
        });

        expect(imported.kind).toBeNull();
        expect(parseDocumentContent(imported.content).kind).toBe('plain');
    });

    it('honours a plain override on a document that would otherwise be a book', async () => {
        const imported = await buildImportedDocumentContent(markdown('book.md', outline), {
            structure: 'plain',
        });

        expect(imported.kind).toBeNull();
        expect(parseDocumentContent(imported.content).kind).toBe('plain');
    });

    it('leaves plain text alone whatever the structure option', async () => {
        const imported = await buildImportedDocumentContent(
            { fileName: 'notes.txt', mimeType: 'text/plain', bytes: encoder.encode(outline) },
            { structure: 'book' },
        );

        expect(imported.kind).toBeNull();
    });
});
