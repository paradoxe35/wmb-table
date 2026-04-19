import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../database/test-helpers';
import * as notesRepo from '@main/database/repositories/notes.repository';
import { importDocumentIntoNote } from '@main/services/note-import.service';

const encoder = new TextEncoder();

function buildImportInput(text: string, fileName = 'Imported Notes.txt') {
    return {
        fileName,
        mimeType: 'text/plain',
        bytes: encoder.encode(text),
    };
}

describe('note-import.service', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('imports content into an empty default note and renames it from the file name', async () => {
        const note = notesRepo.create('Nouvelle note');

        const imported = await importDocumentIntoNote(
            note.id,
            buildImportInput('First paragraph.\n\nSecond paragraph.'),
        );

        expect(imported.name).toBe('Imported Notes');
        expect(imported.defaultName).toBe(false);
        expect(imported.content).toBe('<p>First paragraph.</p>\n<p>Second paragraph.</p>');
    });

    it('rejects imports when the note already has content', async () => {
        const note = notesRepo.create('Existing');
        notesRepo.updateContent(note.id, '<p>Hello world</p>');

        await expect(
            importDocumentIntoNote(note.id, buildImportInput('New content')),
        ).rejects.toThrow('Cette note contient déjà du contenu.');
    });
});
