import { z } from 'zod';
import { marked } from 'marked';
import * as notesRepo from '@main/database/repositories/notes.repository';
import type { AiToolDefinition } from './types';

export function buildNoteTools(_defaultContentLanguage: string): Record<string, AiToolDefinition> {
    return {
        getNotes: {
            description:
                'List all user notes with their IDs and names. ' +
                'Use getNoteById to get the full content of a specific note.',
            inputSchema: z.object({}),
            execute: async () => {
                return notesRepo.getAllSummary();
            },
        },
        getNoteById: {
            description: 'Get a note with its full content and references by id.',
            inputSchema: z.object({ noteId: z.string() }),
            execute: async ({ noteId: rawNoteId }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) return { error: `Note "${noteId}" not found.` };
                return note;
            },
        },
        createNote: {
            description:
                'Create a new note. Content is markdown. ' +
                'You can include wmb:// reference links — they will be clickable in the note.',
            inputSchema: z.object({
                name: z.string().min(2),
                content: z.string().optional().describe('content in markdown'),
            }),
            execute: async ({ name, content }) => {
                const note = notesRepo.create(name.trim());
                notesRepo.rename(note.id, name.trim());

                if (content) {
                    try {
                        const htmlContent = await parseNoteMarkdown(content, name);
                        notesRepo.updateContent(note.id, htmlContent);
                    } catch (err) {
                        return {
                            error: `Note created but content failed: ${err instanceof Error ? err.message : String(err)}`,
                        };
                    }
                }

                return { id: note.id, name: name.trim() };
            },
        },
        updateNoteContent: {
            description:
                'Replace the content of a note. Content is markdown. ' +
                'You can include wmb:// reference links — they will be clickable in the note.',
            inputSchema: z.object({ noteId: z.string(), content: z.string() }),
            execute: async ({ noteId: rawNoteId, content }) => {
                const noteId = rawNoteId.trim();
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
                return { id: note.id, name: note.name };
            },
        },
    };
}

/**
 * Convert wmb:// URLs to http://w.t/#wmb/ format that CKEditor allows,
 * and encode spaces so the markdown parser doesn't break them.
 */
function sanitizeWmbLinks(content: string): string {
    return content
        .replace(/`(\[[^\]]+\]\(wmb:\/\/[^)]+\))`/g, '$1')
        .replace(
            /\]\(wmb:\/\/([^)]+)\)/g,
            (_, path: string) => `](http://w.t/#wmb/${path.replace(/ /g, '%20')})`,
        );
}

async function parseNoteMarkdown(content: string, title: string): Promise<string> {
    let html = await marked.parse(sanitizeWmbLinks(content));
    if (!html.includes('<h1>')) {
        html = `<h1>${title}</h1>\n${html}`;
    }
    return html;
}
