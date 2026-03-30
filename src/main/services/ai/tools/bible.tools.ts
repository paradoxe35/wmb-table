import { z } from 'zod';
import * as aiBibleRepo from '@main/database/repositories/ai-bible.repository';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import type { AiToolDefinition } from './types';
import { validateLanguage } from './shared';

export function buildBibleTools(defaultContentLanguage: string): Record<string, AiToolDefinition> {
    return {
        getBibleVersions: {
            description:
                'List Bible versions available for a language or the current active version.',
            inputSchema: z.object({ languageCode: z.string().optional() }),
            execute: async ({ languageCode }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;
                return aiBibleRepo.getAvailableVersions(lang);
            },
        },
        getBiblePassage: {
            description:
                'Retrieve Bible verses. Provide the book name as it appears in the Bible ' +
                '(e.g. "Genesis", "Revelation", "Jean", "Matthieu", "Apocalypse"). ' +
                'Provide chapter and verse numbers as digits. ' +
                'Use getBibleVersions first to find available abbreviations if needed.',
            inputSchema: z.object({
                book: z
                    .string()
                    .describe(
                        'Book name as written in the Bible (e.g. "Genesis", "Jean", "Matthieu", "Apocalypse")',
                    ),
                chapter: z.string().describe('Chapter number (e.g. "3")'),
                fromVerse: z.string().optional().describe('Starting verse number (e.g. "16")'),
                toVerse: z.string().optional().describe('Ending verse number (e.g. "18")'),
                abbreviation: z.string().optional().describe('Bible version abbreviation'),
                languageCode: z.string().optional(),
            }),
            execute: async ({ languageCode, ...rest }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;
                return aiBibleRepo.getPassage({ ...rest, languageCode: lang });
            },
        },
        searchBible: {
            description:
                'Full-text search across Bible verses. Returns matching verses ranked by relevance. ' +
                'Use this to find verses containing specific words or phrases.',
            inputSchema: z.object({
                query: z.string().min(3).describe('Search query (min 3 characters)'),
                testament: z
                    .enum(['O', 'N'])
                    .optional()
                    .describe('Filter by testament: "O" (Old) or "N" (New)'),
                abbreviation: z.string().optional().describe('Bible version abbreviation'),
                languageCode: z.string().optional(),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(40)
                    .optional()
                    .describe('Max results (default 20)'),
            }),
            execute: async ({ languageCode, ...rest }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;
                return aiBibleRepo.searchVerses({ ...rest, languageCode: lang });
            },
        },
        addBibleReferenceToSubject: {
            description:
                'Add a Bible verse range to a subject. Use the subject ID from getSubjects.',
            inputSchema: z.object({
                subjectId: z.string().describe('The subject ID (from getSubjects)'),
                abbreviation: z.string().optional(),
                languageCode: z.string().optional(),
                book: z.string(),
                chapter: z.string(),
                fromVerse: z.string(),
                toVerse: z.string().optional(),
            }),
            execute: async ({ subjectId: rawSubjectId, languageCode, ...rest }) => {
                const subjectId = rawSubjectId.trim();
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;

                const result = aiBibleRepo.getPassage({ ...rest, languageCode: lang });
                if ('error' in result) return result;

                const verse = result[0];
                if (!verse) return { error: 'Passage biblique introuvable.' };

                const title = `${verse.bookName} ${verse.chapter}`;
                const bibleContent = result
                    .map((v) => {
                        return `${v.bookName} ${v.chapter}:${v.verse} ${v.content}`;
                    })
                    .join(' ');

                const item = subjectsRepo.createItem(
                    subjectId,
                    title,
                    {
                        paragraphIndex: 0,
                        translationId: 0,
                        languageCode: lang,
                        documentType: 'bible',
                        bibleBook: verse.book,
                        bibleChapter: verse.chapter,
                        bibleVersionAbbreviation: rest.abbreviation,
                    },
                    bibleContent,
                    verse,
                    '',
                );

                return { id: item.id, subjectId, documentTitle: title };
            },
        },
    };
}
