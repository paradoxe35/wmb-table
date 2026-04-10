import { z } from 'zod';
import { marked } from 'marked';
import TurndownService from 'turndown';
import * as notesRepo from '@main/database/repositories/notes.repository';
import type { AiToolDefinition } from './types';

const turndownService = new TurndownService();
const htmlToMarkdown = (html: string) => {
    // Convert HTML to markdown first to preserve some structure,
    // then convert to plain text
    const markdown = turndownService.turndown(html);
    return markdown.replace(/\n+/g, '\n').trim();
};

export function buildNoteTools(_defaultContentLanguage: string): Record<string, AiToolDefinition> {
    return {
        getNotes: {
            description:
                'List all user notes with their IDs and names. ' +
                'Use getNoteById to get the full content of a specific note.',
            inputSchema: z.object({}),
            execute: async () => {
                const notes = notesRepo.getAllSummary();
                return notes.map((n) => ({ noteId: n.id, name: n.name }));
            },
        },
        getNoteById: {
            description:
                'Get a note by id with model-friendly readable text content. ' +
                'Returns markdown text extracted from the stored editor HTML so it is easier to read, summarize, and edit.',
            inputSchema: z.object({ noteId: z.string() }),
            execute: async ({ noteId: rawNoteId }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) {
                    return {
                        error: `Note "${noteId}" not found.`,
                    };
                }

                return {
                    noteId: note.id,
                    name: note.name,
                    content: htmlToMarkdown(note.content ?? ''),
                };
            },
        },
        createNote: {
            description:
                'Create a new note. Content MUST be markdown (not HTML). ' +
                'You can include wmb:// reference links',
            inputSchema: z.object({
                name: z.string().min(2).describe('note name/title'),
                content: z.string().describe('note content in markdown format, NOT HTML'),
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

                return { noteId: note.id, name: name.trim() };
            },
        },
        updateNoteContent: {
            description:
                'Replace the content of a note. Content MUST be markdown (not HTML). ' +
                'You can include wmb:// reference links.',
            inputSchema: z.object({
                noteId: z.string(),
                content: z.string().describe('note content in markdown format, NOT HTML'),
            }),
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
                return { noteId: note.id, name: note.name };
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

function convertWmbHrefLinks(html: string): string {
    return html.replace(
        /href="wmb:\/\/([^"]+)"/g,
        (_, path: string) => `href="http://w.t/#wmb/${path}"`,
    );
}

async function parseNoteMarkdown(content: string, title: string): Promise<string> {
    let html = await marked.parse(sanitizeWmbLinks(content));
    html = convertWmbHrefLinks(html);

    if (!html.includes('<h1>')) {
        html = `<h1>${title}</h1>\n${html}`;
    }
    return html;
}
