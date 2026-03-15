import { z } from 'zod';
import { marked } from 'marked';
import * as notesRepo from '@main/database/repositories/notes.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import type { AiToolDefinition } from './types';
import { inferTranslationId } from './shared';

export function buildNoteTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
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
                notesRepo.updateContent(noteId, content);
                const updated = notesRepo.getById(noteId);
                if (!updated) throw new Error('Note not found');
                return updated;
            },
        },
        addSermonReferenceToNote: {
            description: 'Add a sermon paragraph reference to a note.',
            inputSchema: z.object({
                noteId: z.string(),
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                paragraphIndex: z.number().int().min(0),
                label: z.string().min(1),
            }),
            execute: async ({
                noteId,
                sermonId,
                languageCode,
                translationId,
                paragraphIndex,
                label,
            }) => {
                const lang = languageCode ?? defaultLanguageCode;
                const meta =
                    referenceDataService.getSermonMeta(
                        translationId ?? inferTranslationId(sermonId, lang),
                        lang,
                        sermonId,
                    ) ??
                    referenceDataService.getSermonListForLanguage(lang).find((sermon) => {
                        return sermon.sermonId === sermonId;
                    });
                if (!meta) throw new Error('Sermon introuvable');

                const paragraphs = await tantivyService.getSermonParagraphs(
                    lang,
                    meta.translationId,
                    meta.dateMs,
                );
                const paragraph = paragraphs[paragraphIndex];
                if (!paragraph) throw new Error('Paragraphe introuvable');

                const reference = notesRepo.createReference(noteId, label, sermonId);
                notesRepo.updateReference(
                    reference.id,
                    {
                        textContent: paragraph.content,
                        documentHtmlTree: {
                            paragraphIndex,
                            translationId: meta.translationId,
                            languageCode: lang,
                            sermonId: meta.sermonId,
                            documentType: 'sermon',
                        },
                    },
                    meta.title,
                    meta.sermonId,
                );
                const ref = notesRepo.getReference(reference.id);
                if (!ref) throw new Error('Failed to retrieve created reference');
                return ref;
            },
        },
    };
}
