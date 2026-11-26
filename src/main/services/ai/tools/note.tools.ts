import { z } from 'zod';
import * as notesRepo from '@main/database/repositories/notes.repository';
import { applyNoteEdits } from '@main/lib/note-edit';
import {
    findUnsupportedFormatting,
    markdownToNoteHtml,
    noteHtmlToMarkdown,
} from '@main/lib/note-markdown';
import { escapeHtml } from '@shared/searchable';
import type { AiToolDefinition } from './types';

const NOTE_CONTENT_RULES =
    'Write only the note content itself. Do not include assistant-style remarks, ' +
    'follow-up invitations, user instructions, or meta/workflow text.';

const NOTE_WMB_LINK_RULE =
    'Always render sermon, Bible, and document references as `wmb://` markdown links when tool data exists — never as plain text or raw IDs.';

const MARKDOWN_INPUT_DESCRIPTION = 'note content in markdown format, NOT HTML';

const DEFAULT_MAX_LINES = 200;
const MAX_LINES = 400;
const MAX_EDITS = 20;

function noteNotFound(noteId: string) {
    return { error: `Note "${noteId}" not found.` };
}

function failureMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

const FORMATTING_LABELS: Record<string, string> = {
    '<table>': 'a table',
    '<u>': 'underlined text',
    '<ins>': 'underlined text',
    '<s>': 'struck-through text',
    '<strike>': 'struck-through text',
    '<del>': 'struck-through text',
    '<sub>': 'subscript text',
    '<sup>': 'superscript text',
    '<mark>': 'highlighted text',
    style: 'colours, highlights, alignment or indentation',
    lang: 'language marks',
};

function describeFormatting(construct: string): string {
    if (construct.startsWith('data-')) return 'page breaks, checklists or other special blocks';
    return FORMATTING_LABELS[construct] ?? construct;
}

function refuseLossyRewrite(noteId: string, construct: string) {
    return {
        error:
            `Note "${noteId}" contains ${describeFormatting(construct)}, which markdown cannot carry. ` +
            'Rewriting the whole note would remove that formatting, so the note was not changed. ' +
            'Use editNote to change the plain parts of the note, or appendToNote to add a section. ' +
            'If the formatted part itself must change, ask the user to edit it in the note editor.',
    };
}

async function buildNoteHtml(markdown: string, title: string): Promise<string> {
    const html = await markdownToNoteHtml(markdown);
    return html.includes('<h1>') ? html : `<h1>${escapeHtml(title)}</h1>\n${html}`;
}

export function buildNoteTools(): Record<string, AiToolDefinition> {
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
                'Get a note by id as markdown text. ' +
                'Long notes are paginated with startLine and maxLines. ' +
                'Copy snippets from this content verbatim when calling editNote.',
            inputSchema: z.object({
                noteId: z.string(),
                startLine: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe('Line offset to start from (default 0)'),
                maxLines: z
                    .number()
                    .int()
                    .min(1)
                    .max(MAX_LINES)
                    .optional()
                    .describe(`Maximum number of lines to return (default ${DEFAULT_MAX_LINES})`),
            }),
            execute: async ({ noteId: rawNoteId, startLine = 0, maxLines = DEFAULT_MAX_LINES }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) return noteNotFound(noteId);

                const markdown = noteHtmlToMarkdown(note.content ?? '');
                const lines = markdown ? markdown.split('\n') : [];
                const visible = lines.slice(startLine, startLine + maxLines);

                return {
                    noteId: note.id,
                    name: note.name,
                    content: visible.join('\n'),
                    totalLines: lines.length,
                    startLine,
                    returnedLines: visible.length,
                    hasMore: startLine + visible.length < lines.length,
                };
            },
        },
        createNote: {
            description:
                'Create a new note. Content MUST be markdown (not HTML). ' +
                NOTE_WMB_LINK_RULE +
                ' ' +
                NOTE_CONTENT_RULES,
            inputSchema: z.object({
                name: z.string().min(2).describe('note name/title'),
                content: z.string().describe(MARKDOWN_INPUT_DESCRIPTION),
            }),
            execute: async ({ name, content }) => {
                const title = name.trim();
                const note = notesRepo.create(title);
                notesRepo.rename(note.id, title);

                if (content.trim()) {
                    try {
                        notesRepo.updateContent(note.id, await buildNoteHtml(content, title));
                    } catch (err) {
                        return {
                            noteId: note.id,
                            name: title,
                            error: `Note created but empty — writing its content failed: ${failureMessage(err)}. Add the content with updateNoteContent.`,
                        };
                    }
                }

                return { noteId: note.id, name: title };
            },
        },
        editNote: {
            description:
                'Make targeted edits to an existing note without rewriting it. ' +
                'Prefer this over updateNoteContent for any change to an existing note. ' +
                'Each edit replaces an exact markdown snippet copied from getNoteById. ' +
                'oldText must match exactly one place: include surrounding text to make it unique, ' +
                'or set replaceAll to change every occurrence. ' +
                'An empty newText deletes the snippet. Edits apply in order and all-or-nothing — ' +
                'if any edit fails, the note is left untouched. ' +
                'Keep whole `[label](url)` links inside oldText: an anchor that cuts a link is refused. ' +
                NOTE_WMB_LINK_RULE +
                ' ' +
                NOTE_CONTENT_RULES,
            inputSchema: z.object({
                noteId: z.string(),
                edits: z
                    .array(
                        z.object({
                            oldText: z
                                .string()
                                .min(1)
                                .describe(
                                    'exact markdown snippet to replace, copied from getNoteById',
                                ),
                            newText: z
                                .string()
                                .describe('replacement markdown; empty string deletes the snippet'),
                            replaceAll: z
                                .boolean()
                                .optional()
                                .describe(
                                    'replace every occurrence instead of failing on multiple matches',
                                ),
                        }),
                    )
                    .min(1)
                    .max(MAX_EDITS),
            }),
            execute: async ({ noteId: rawNoteId, edits }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) return noteNotFound(noteId);
                if (!note.content?.trim()) {
                    return {
                        error: `Note "${noteId}" is empty. Use appendToNote or updateNoteContent to add content.`,
                    };
                }

                const result = await applyNoteEdits(note.content, edits);
                if ('error' in result) return result;

                try {
                    notesRepo.updateContent(noteId, result.html);
                } catch (err) {
                    return { error: `Failed to save the note: ${failureMessage(err)}` };
                }

                return { noteId: note.id, name: note.name, replacements: result.replacements };
            },
        },
        appendToNote: {
            description:
                'Append markdown content to the end of a note, leaving existing content untouched. ' +
                'Use this to add a new section instead of rewriting the note. ' +
                NOTE_WMB_LINK_RULE +
                ' ' +
                NOTE_CONTENT_RULES,
            inputSchema: z.object({
                noteId: z.string(),
                content: z.string().min(1).describe(MARKDOWN_INPUT_DESCRIPTION),
            }),
            execute: async ({ noteId: rawNoteId, content }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) return noteNotFound(noteId);

                const appended = await markdownToNoteHtml(content);
                if (!appended) return { error: 'The content to append is empty.' };

                const existing = note.content?.trim();
                try {
                    notesRepo.updateContent(
                        noteId,
                        existing ? `${existing}\n${appended}` : appended,
                    );
                } catch (err) {
                    return { error: `Failed to save the note: ${failureMessage(err)}` };
                }

                return { noteId: note.id, name: note.name };
            },
        },
        updateNoteContent: {
            description:
                'Replace the entire content of a note. Only use this for a full rewrite — ' +
                'use editNote for targeted changes and appendToNote to add a section. ' +
                'Content MUST be markdown (not HTML). ' +
                NOTE_WMB_LINK_RULE +
                ' ' +
                NOTE_CONTENT_RULES,
            inputSchema: z.object({
                noteId: z.string(),
                content: z.string().describe(MARKDOWN_INPUT_DESCRIPTION),
            }),
            execute: async ({ noteId: rawNoteId, content }) => {
                const noteId = rawNoteId.trim();
                const note = notesRepo.getById(noteId);
                if (!note) return noteNotFound(noteId);

                const lossy = findUnsupportedFormatting(note.content ?? '');
                if (lossy) return refuseLossyRewrite(noteId, lossy);

                try {
                    notesRepo.updateContent(noteId, await buildNoteHtml(content, note.name));
                } catch (err) {
                    return { error: `Failed to update note: ${failureMessage(err)}` };
                }

                return { noteId: note.id, name: note.name };
            },
        },
    };
}
