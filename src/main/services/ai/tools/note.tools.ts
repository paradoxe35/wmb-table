import { z } from 'zod';
import { marked } from 'marked';
import * as notesRepo from '@main/database/repositories/notes.repository';
import type { AiToolDefinition } from './types';

export function buildNoteTools(_defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        getNotes: {
            description: 'List all user notes with their names and ids.',
            inputSchema: z.object({}),
            execute: async () => {
                return notesRepo.getAll();
            },
        },
        getNoteById: {
            description: 'Get a note with its full content and references by id.',
            inputSchema: z.object({ noteId: z.string() }),
            execute: async ({ noteId }) => {
                return notesRepo.getById(noteId);
            },
        },
        createNote: {
            description: 'Create a new note.',
            inputSchema: z.object({
                name: z.string().min(2),
                content: z.string().optional().describe('content in markdown'),
            }),
            execute: async ({ name, content }) => {
                const note = notesRepo.create(name.trim());
                if (content) {
                    let htmlContent = await marked.parse(content);
                    if (!htmlContent.includes('<h1>')) {
                        htmlContent = `<h1>${name}</h1>\n${htmlContent}`;
                    }

                    notesRepo.updateContent(note.id, htmlContent);
                }
                const created = notesRepo.getById(note.id);
                if (!created) throw new Error('Failed to retrieve created note');
                return created;
            },
        },
        updateNoteContent: {
            description: 'Replace the content of a note.',
            inputSchema: z.object({ noteId: z.string(), content: z.string() }),
            execute: async ({ noteId, content }) => {
                const note = notesRepo.getById(noteId);
                if (!note) throw new Error('Note not found');

                let htmlContent = await marked.parse(content);
                if (!htmlContent.includes('<h1>')) {
                    htmlContent = `<h1>${note.name}</h1>\n${htmlContent}`;
                }

                notesRepo.updateContent(noteId, content);
                return notesRepo.getById(noteId);
            },
        },
    };
}
