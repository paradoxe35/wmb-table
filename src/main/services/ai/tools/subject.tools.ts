import { z } from 'zod';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as referenceDataService from '@main/services/reference-data.service';
import * as tantivyService from '@main/services/tantivy.service';
import type { AiToolDefinition } from './types';
import { inferTranslationId, validateLanguage } from './shared';

export function buildSubjectTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        getSubjects: {
            description:
                'List all subjects (topics/themes) created by the user with their references.',
            inputSchema: z.object({}),
            execute: async () => {
                return subjectsRepo.getAll();
            },
        },
        createSubject: {
            description: 'Create a new subject.',
            inputSchema: z.object({ name: z.string().min(2) }),
            execute: async ({ name }) => {
                return subjectsRepo.create(name.trim());
            },
        },
        addSermonReferenceToSubject: {
            description: 'Add a sermon paragraph reference to a subject.',
            inputSchema: z.object({
                subjectName: z.string(),
                sermonId: z.string(),
                languageCode: z.string().optional(),
                translationId: z.number().int().optional(),
                paragraphIndex: z.number().int().min(0),
            }),
            execute: async ({
                subjectName,
                sermonId,
                languageCode,
                translationId,
                paragraphIndex,
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

                const langError = validateLanguage(lang);
                if (langError) return langError;

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
                const paragraph = paragraphs[paragraphIndex];
                if (!paragraph) throw new Error('Paragraphe introuvable');

                return subjectsRepo.createItem(
                    subjectName,
                    meta.title,
                    {
                        paragraphIndex,
                        translationId: meta.translationId,
                        languageCode: lang,
                        sermonId: meta.sermonId,
                        documentType: 'sermon',
                    },
                    paragraph.content,
                    undefined,
                    meta.sermonId,
                );
            },
        },
    };
}
