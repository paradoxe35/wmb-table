import { BrowserWindow, dialog } from 'electron';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NotesChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as notesRepo from '@main/database/repositories/notes.repository';
import { getMainWindow } from '@main/lib/window';

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

    registerHandler(NotesChannels.deleteReference, async (_event, id) => {
        notesRepo.deleteReference(id);
    });

    registerHandler(NotesChannels.exportPdf, async (_event, noteId) => {
        const note = notesRepo.getById(noteId);
        if (!note?.content) {
            throw new Error('Note introuvable ou vide');
        }

        const parentWindow = getMainWindow();
        const defaultName = (note.name || 'note').replace(/\s+/g, '-').toLowerCase();

        const { canceled, filePath } = await dialog.showSaveDialog(
            parentWindow ?? BrowserWindow.getFocusedWindow()!,
            {
                title: 'Exporter PDF',
                defaultPath: `${defaultName}.pdf`,
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            },
        );

        if (canceled || !filePath) {
            return '';
        }

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${note.name}</title>
<style>
  body { font-family: serif; font-size: 14px; padding: 20px; color: #333; }
  h1, h2, h3 { font-family: sans-serif; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 6px; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 12px; color: #555; }
</style>
</head><body>
${note.content}
</body></html>`;

        const tmpFile = join(tmpdir(), `wmb-note-${randomUUID()}.html`);
        await writeFile(tmpFile, html, 'utf-8');

        const hiddenWindow = new BrowserWindow({
            show: false,
            width: 800,
            height: 600,
            webPreferences: { offscreen: true },
        });

        try {
            await hiddenWindow.loadFile(tmpFile);
            const pdfBuffer = await hiddenWindow.webContents.printToPDF({
                printBackground: true,
                margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
            });
            await writeFile(filePath, pdfBuffer);
            return filePath;
        } finally {
            hiddenWindow.destroy();
            unlink(tmpFile).catch(() => {});
        }
    });
}
