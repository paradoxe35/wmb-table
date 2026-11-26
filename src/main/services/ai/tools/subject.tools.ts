import { z } from 'zod';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import { buildParagraphReference, buildSermonDocumentIdentity } from '@shared/types';
import type { SermonParagraph } from '@shared/types';
import type { AiToolDefinition } from './types';
import { inferTranslationId, validateLanguage } from './shared';

function paragraphNotFound(
    paragraphNumber: number,
    sermonId: string,
    paragraphs: SermonParagraph[],
): { error: string } {
    const first = paragraphs[0]?.paragraphIndex;
    const last = paragraphs.at(-1)?.paragraphIndex;
    const range =
        first === undefined
            ? 'it has no paragraphs'
            : `its paragraphs are numbered ${first} to ${last}`;
    return { error: `Paragraph ${paragraphNumber} not found in sermon "${sermonId}"; ${range}.` };
}

export function buildSubjectTools(
    defaultContentLanguage: string,
): Record<string, AiToolDefinition> {
    return {
        getSubjects: {
            description:
                'List saved subjects with IDs and names. ' +
                'They are organizational data, not the default source for open-ended theme suggestions. ' +
                'Use for saved-subject workflows or when saved-subject context is needed. ' +
                'Use getSubjectById for one saved subject.',
            inputSchema: z.object({}),
            execute: async () => {
                const subjects = subjectsRepo.getAllSummary();
                return subjects.map((s) => ({ subjectId: s.id, name: s.name, date: s.date }));
            },
        },
        getSubjectById: {
            description:
                'Get one saved subject and its references by ID. ' +
                'Use when a saved-subject workflow needs inspection.',
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
            description:
                'Create a saved subject when the user wants to save or organize content under a subject, or accepts that suggestion.',
            inputSchema: z.object({ name: z.string().min(2) }),
            execute: async ({ name: rawName }) => {
                const name = rawName.trim();
                const existing = subjectsRepo
                    .getAllSummary()
                    .find((subject) => subject.name === name);
                if (existing) {
                    return {
                        error: `A subject named "${name}" already exists (subjectId "${existing.id}"). Use that subject instead of creating a new one.`,
                    };
                }

                try {
                    const subject = subjectsRepo.create(name);
                    return { subjectId: subject.id, name: subject.name };
                } catch (err) {
                    return {
                        error: `Failed to create subject: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
        addSermonReferenceToSubject: {
            description:
                'Add a sermon paragraph reference to a saved subject. ' +
                'Use for saved-subject organization. Use the subject ID from getSubjects.',
            inputSchema: z.object({
                subjectId: z.string().describe('The subject ID (from getSubjects)'),
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                paragraphNumber: z
                    .number()
                    .int()
                    .min(0)
                    .describe('Paragraph number from getSermonContent or searchContent'),
            }),
            execute: async ({
                subjectId: rawSubjectId,
                sermonId: rawSermonId,
                languageCode,
                translationId,
                paragraphNumber,
            }) => {
                const subjectId = rawSubjectId.trim();
                const sermonId = rawSermonId.trim();
                if (!subjectsRepo.exists(subjectId)) {
                    return { error: `Subject "${subjectId}" not found.` };
                }

                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;

                const resolvedTranslationId = translationId ?? inferTranslationId(sermonId, lang);
                const meta =
                    (resolvedTranslationId != null
                        ? referenceDataService.getSermonMeta(resolvedTranslationId, lang, sermonId)
                        : null) ??
                    referenceDataService.getSermonListForLanguage(lang).find((sermon) => {
                        return sermon.sermonId === sermonId;
                    });
                if (!meta) {
                    return {
                        error: `Sermon "${sermonId}" not found for language "${lang}". Use searchSermons to find its sermonId and translationId.`,
                    };
                }

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
                const paragraph = paragraphs.find((p) => p.paragraphIndex === paragraphNumber);
                if (!paragraph) return paragraphNotFound(paragraphNumber, sermonId, paragraphs);

                let item;
                try {
                    item = subjectsRepo.createItem(
                        subjectId,
                        meta.title,
                        buildParagraphReference(
                            buildSermonDocumentIdentity(meta.sermonId, meta.translationId, lang),
                            paragraphNumber,
                        ),
                        paragraph.content,
                    );
                } catch (err) {
                    return {
                        error: `Failed to add the reference: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
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
                'Remove a reference from a saved subject. ' +
                'Pass the subject ID and the reference ID, both from getSubjectById. ' +
                'To modify a reference, remove it and add a new one.',
            inputSchema: z.object({
                subjectId: z.string().describe('The subject ID the reference belongs to'),
                referenceId: z
                    .string()
                    .describe('The reference ID (referenceId from getSubjectById documents)'),
            }),
            execute: async ({ subjectId: rawSubjectId, referenceId }) => {
                const subjectId = rawSubjectId.trim();
                const id = referenceId.trim();
                try {
                    if (!subjectsRepo.exists(subjectId)) {
                        return { error: `Subject "${subjectId}" not found.` };
                    }

                    const item = subjectsRepo.getItem(id);
                    if (!item) {
                        return {
                            error: `Reference "${id}" not found. Use getSubjectById to list the subject's reference ids.`,
                        };
                    }
                    if (item.subjectId !== subjectId) {
                        return {
                            error: `Reference "${id}" does not belong to subject "${subjectId}". Nothing was removed; use getSubjectById to list that subject's reference ids.`,
                        };
                    }

                    subjectsRepo.deleteItem(id);
                    return {
                        success: true,
                        deletedId: id,
                        subjectId,
                        documentTitle: item.documentTitle,
                    };
                } catch (err) {
                    return {
                        error: `Failed to remove reference: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            },
        },
    };
}
