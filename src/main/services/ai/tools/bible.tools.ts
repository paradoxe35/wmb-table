import { z } from 'zod';
import * as aiBibleRepo from '@main/database/repositories/ai-bible.repository';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as notesRepo from '@main/database/repositories/notes.repository';
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
                'Retrieve a Bible chapter or verse range from a specific version or language.',
            inputSchema: z.object({
                book: z.string(),
                chapter: z.string(),
                fromVerse: z.string().optional(),
                toVerse: z.string().optional(),
                abbreviation: z.string().optional(),
                languageCode: z.string().optional(),
            }),
            execute: async (input) => {
                return aiBibleRepo.getPassage(input);
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
                if (!verse) throw new Error('Passage biblique introuvable');

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
        addBibleReferenceToNote: {
            description: 'Add Bible verses to a note.',
            inputSchema: z.object({
                noteId: z.string(),
                label: z.string().min(1),
                abbreviation: z.string().optional(),
                languageCode: z.string().optional(),
                book: z.string(),
                chapter: z.string(),
                fromVerse: z.string(),
                toVerse: z.string().optional(),
            }),
            execute: async ({ noteId, label, ...rest }) => {
                const verses = aiBibleRepo.getPassage(rest);
                if (verses.length === 0) throw new Error('Passage biblique introuvable');
                const ref = notesRepo.createBibleReference(noteId, label);
                for (const verse of verses) {
                    notesRepo.addBibleVerse(ref.id, verse.id);
                }
                return notesRepo.getBibleReference(ref.id);
            },
        },
    };
}
