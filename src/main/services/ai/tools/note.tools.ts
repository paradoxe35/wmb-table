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
                const note = notesRepo.getById(noteId);
                if (!note) return { error: `Note "${noteId}" not found.` };
                return note;
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
                if (!content) return note;

                try {
                    const htmlContent = await parseNoteMarkdown(content, name);
                    notesRepo.updateContent(note.id, htmlContent);
                } catch (err) {
                    return {
                        error: `Note created but content failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
                return notesRepo.getById(note.id) ?? note;
            },
        },
        updateNoteContent: {
            description: 'Replace the content of a note.',
            inputSchema: z.object({ noteId: z.string(), content: z.string() }),
            execute: async ({ noteId, content }) => {
                const note = notesRepo.getById(noteId);
                if (!note) return { error: `Note "${noteId}" not found.` };

                try {
                    const htmlContent = await parseNoteMarkdown(content, note.name);
                    notesRepo.updateContent(noteId, htmlContent);
                } catch (err) {
                    return {
                        error: `Failed to update note: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
                return notesRepo.getById(noteId) ?? note;
            },
        },
    };
}

async function parseNoteMarkdown(content: string, title: string): Promise<string> {
    let html = await marked.parse(content);
    if (!html.includes('<h1>')) {
        html = `<h1>${title}</h1>\n${html}`;
    }
    return html;
}
