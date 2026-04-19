import * as notesRepo from '@main/database/repositories/notes.repository';
import { hasMeaningfulHtmlContent } from '@shared/html-content';
import type { CustomDocumentImportInput, NoteItem } from '@shared/types';
import {
    extractHtmlFromImportedDocument,
    inferImportedDocumentName,
} from './document-import.service';

export async function importDocumentIntoNote(
    noteId: string,
    input: CustomDocumentImportInput,
): Promise<NoteItem> {
    const note = notesRepo.getById(noteId);
    if (!note) {
        throw new Error('Note introuvable.');
    }

    if (hasMeaningfulHtmlContent(note.content)) {
        throw new Error('Cette note contient déjà du contenu.');
    }

    const content = await extractHtmlFromImportedDocument(input);
    const inferredName = inferImportedDocumentName(input.fileName);

    if (note.defaultName && inferredName) {
        notesRepo.rename(noteId, inferredName);
    }

    notesRepo.updateContent(noteId, content);

    return notesRepo.getById(noteId)!;
}
