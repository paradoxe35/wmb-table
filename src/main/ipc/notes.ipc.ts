import { NotesChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as notesRepo from '@main/database/repositories/notes.repository';

export function registerNotesHandlers(): void {
    registerHandler(NotesChannels.getAll, async () => {
        return notesRepo.getAll();
    });

    registerHandler(NotesChannels.getById, async (_event, id) => {
        return notesRepo.getById(id);
    });

    registerHandler(NotesChannels.create, async (_event, name) => {
        return notesRepo.create(name);
    });

    registerHandler(NotesChannels.delete, async (_event, id) => {
        notesRepo.deleteNote(id);
    });

    registerHandler(NotesChannels.rename, async (_event, id, newName) => {
        return notesRepo.rename(id, newName);
    });

    registerHandler(NotesChannels.updateContent, async (_event, id, content) => {
        notesRepo.updateContent(id, content);
    });

    registerHandler(NotesChannels.getReferences, async (_event, noteId) => {
        return notesRepo.getReferences(noteId);
    });

    registerHandler(NotesChannels.createReference, async (_event, noteId, label) => {
        return notesRepo.createReference(noteId, label);
    });

    registerHandler(NotesChannels.getReference, async (_event, id) => {
        return notesRepo.getReference(id);
    });

    registerHandler(NotesChannels.syncReferences, async (_event, noteId, refs) => {
        notesRepo.syncReferences(noteId, refs);
    });

    registerHandler(
        NotesChannels.updateReference,
        async (_event, id, ref, documentTitle, sermonId) => {
            notesRepo.updateReference(id, ref, documentTitle, sermonId);
        },
    );

    registerHandler(NotesChannels.getBibleReference, async (_event, id) => {
        return notesRepo.getBibleReference(id);
    });

    registerHandler(NotesChannels.getBibleReferences, async (_event, noteId) => {
        return notesRepo.getBibleReferences(noteId);
    });

    registerHandler(NotesChannels.createBibleReference, async (_event, noteId, label) => {
        return notesRepo.createBibleReference(noteId, label);
    });

    registerHandler(NotesChannels.syncBibleReferences, async (_event, noteId, refs) => {
        notesRepo.syncBibleReferences(noteId, refs);
    });

    registerHandler(NotesChannels.addBibleVerse, async (_event, refId, verseId) => {
        return notesRepo.addBibleVerse(refId, verseId);
    });

    registerHandler(NotesChannels.removeBibleVerse, async (_event, refId, verseId) => {
        notesRepo.removeBibleVerse(refId, verseId);
    });

    registerHandler(NotesChannels.exportPdf, async () => {
        throw new Error('Not implemented: notes:exportPdf');
    });
}
