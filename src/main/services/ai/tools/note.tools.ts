import { z } from 'zod';
import * as notesRepo from '@main/database/repositories/notes.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import type { AiToolDefinition } from './types';
import { inferTranslationId } from './shared';

export function buildNoteTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        getNotes: {
            description: 'List notes.',
            inputSchema: z.object({}),
            execute: async () => {
                return notesRepo.getAll();
            },
        },
        getNoteById: {
            description: 'Get one note by id.',
            inputSchema: z.object({ noteId: z.string() }),
            execute: async ({ noteId }) => {
                return notesRepo.getById(noteId);
            },
        },
        createNote: {
            description: 'Create a new note.',
            inputSchema: z.object({
                name: z.string().min(2),
                content: z.string().optional(),
            }),
            execute: async ({ name, content }) => {
                const note = notesRepo.create(name.trim());
                if (content) {
                    notesRepo.updateContent(note.id, content);
                }
                return notesRepo.getById(note.id);
            },
        },
        updateNoteContent: {
            description: 'Replace the content of a note.',
            inputSchema: z.object({ noteId: z.string(), content: z.string() }),
            execute: async ({ noteId, content }) => {
                notesRepo.updateContent(noteId, content);
                return notesRepo.getById(noteId);
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
                return notesRepo.getReference(reference.id);
            },
        },
    };
}
