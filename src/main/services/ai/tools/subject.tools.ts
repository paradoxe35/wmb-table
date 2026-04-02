import { z } from 'zod';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import { buildParagraphReference, buildSermonDocumentIdentity } from '@shared/types';
import type { AiToolDefinition } from './types';
import { inferTranslationId, validateLanguage } from './shared';

export function buildSubjectTools(
    defaultContentLanguage: string,
): Record<string, AiToolDefinition> {
    return {
        getSubjects: {
            description:
                'List all subjects (topics/themes) with their IDs and names. ' +
                'Use getSubjectById to get references for a specific subject.',
            inputSchema: z.object({}),
            execute: async () => {
                const subjects = subjectsRepo.getAllSummary();
                return subjects.map((s) => ({ subjectId: s.id, name: s.name, date: s.date }));
            },
        },
        getSubjectById: {
            description: 'Get a single subject with all its references by ID.',
            inputSchema: z.object({
                subjectId: z.string().describe('The subject ID (from getSubjects)'),
            }),
            execute: async ({ subjectId }) => {
                const subject = subjectsRepo.getById(subjectId.trim());
                if (!subject) return { error: `Subject "${subjectId}" not found.` };
                return {
                    subjectId: subject.id,
                    name: subject.name,
                    documents: subject.documents.map((doc) => {
                        const documentIdentity = doc.documentReference.documentIdentity;
                        return {
                            referenceId: doc.id,
                            documentTitle: doc.documentTitle,
                            documentIdentity,
                        };
                    }),
                };
            },
        },
        createSubject: {
            description: 'Create a new subject.',
            inputSchema: z.object({ name: z.string().min(2) }),
            execute: async ({ name }) => {
                const subject = subjectsRepo.create(name.trim());
                return { subjectId: subject.id, name: subject.name };
            },
        },
        addSermonReferenceToSubject: {
            description:
                'Add a sermon paragraph reference to a subject. Use the subject ID from getSubjects.',
            inputSchema: z.object({
                subjectId: z.string().describe('The subject ID (from getSubjects)'),
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                paragraphIndex: z.number().int().min(0),
            }),
            execute: async ({
                subjectId: rawSubjectId,
                sermonId: rawSermonId,
                languageCode,
                translationId,
                paragraphIndex,
            }) => {
                const subjectId = rawSubjectId.trim();
                const sermonId = rawSermonId.trim();
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;

                const meta =
                    referenceDataService.getSermonMeta(
                        translationId ?? inferTranslationId(sermonId, lang),
                        lang,
                        sermonId,
                    ) ??
                    referenceDataService.getSermonListForLanguage(lang).find((sermon) => {
                        return sermon.sermonId === sermonId;
                    });
                if (!meta) return { error: 'Sermon introuvable.' };

                let paragraphs;
                try {
                    paragraphs = await tantivyService.getSermonParagraphs(
                        lang,
                        meta.translationId,
                        meta.dateMs,
                    );
                } catch (err) {
                    return {
                        error: `Failed to retrieve sermon paragraphs: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
                const paragraph = paragraphs.find((p) => p.paragraphIndex === paragraphIndex);
                if (!paragraph) return { error: 'Paragraphe introuvable.' };

                const item = subjectsRepo.createItem(
                    subjectId,
                    meta.title,
                    buildParagraphReference(
                        buildSermonDocumentIdentity(meta.sermonId, meta.translationId, lang),
                        paragraphIndex,
                    ),
                    paragraph.content,
                );
                return {
                    referenceId: item.id,
                    subjectId,
                    documentTitle: meta.title,
                    sermonId: meta.sermonId,
                };
            },
        },
        removeSubjectReference: {
            description:
                'Remove a reference from a subject by its reference ID. ' +
                'Use getSubjectById to find reference IDs. To modify a reference, remove it and add a new one.',
            inputSchema: z.object({
                referenceId: z
                    .string()
                    .describe('The reference item ID (from from getSubjectById documents)'),
            }),
            execute: async ({ referenceId }) => {
                const id = referenceId.trim();
                try {
                    subjectsRepo.deleteItem(id);
                    return { success: true, deletedId: id };
                } catch (err) {
                    return {
                        error: `Failed to remove reference: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
    };
}
