import { z } from 'zod';
import * as aiBibleRepo from '@main/database/repositories/ai-bible.repository';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import type { AiToolDefinition } from './types';

export function buildBibleTools(defaultLanguageCode: string): Record<string, AiToolDefinition> {
    return {
        getBibleVersions: {
            description:
                'List Bible versions available for a language or the current active version.',
            inputSchema: z.object({ languageCode: z.string().optional() }),
            execute: async ({ languageCode }) =>
                aiBibleRepo.getAvailableVersions(languageCode ?? defaultLanguageCode),
        },
        getBiblePassage: {
            description:
                'Retrieve Bible verses. Provide book name, chapter number, and optionally a verse range. ' +
                'Use getBibleVersions first to find available abbreviations if needed.',
            inputSchema: z.object({
                book: z.string().describe('Book name (e.g. "Genesis", "Jean", "Matthieu")'),
                chapter: z.string().describe('Chapter number'),
                fromVerse: z.string().optional().describe('Starting verse number'),
                toVerse: z.string().optional().describe('Ending verse number'),
                abbreviation: z.string().optional().describe('Bible version abbreviation'),
                languageCode: z.string().optional(),
            }),
            execute: async (input) => {
                return aiBibleRepo.getPassage(input);
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
            execute: async (input) => {
                return aiBibleRepo.searchVerses(input);
            },
        },
        addBibleReferenceToSubject: {
            description: 'Add a Bible verse range to a subject.',
            inputSchema: z.object({
                subjectName: z.string(),
                abbreviation: z.string().optional(),
                languageCode: z.string().optional(),
                book: z.string(),
                chapter: z.string(),
                fromVerse: z.string(),
                toVerse: z.string().optional(),
            }),
            execute: async ({ subjectName, ...rest }) => {
                const verses = aiBibleRepo.getPassage(rest);
                const verse = verses[0];
                if (!verse) return { error: 'Passage biblique introuvable.' };

                return subjectsRepo.createItem(
                    subjectName,
                    `${verse.bookName} ${verse.chapter}`,
                    {
                        paragraphIndex: 0,
                        translationId: 0,
                        languageCode: rest.languageCode ?? defaultLanguageCode,
                        documentType: 'bible',
                        bibleBook: verse.book,
                        bibleChapter: verse.chapter,
                        bibleVersionAbbreviation: rest.abbreviation,
                    },
                    verses
                        .map(
                            (item) =>
                                `${item.bookName} ${item.chapter}:${item.verse} ${item.content}`,
                        )
                        .join(' '),
                    verse,
                    '',
                );
            },
        },
    };
}
