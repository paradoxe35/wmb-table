import { z } from 'zod';
import * as aiBibleRepo from '@main/database/repositories/ai-bible.repository';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import type { BibleBook } from '@shared/types';
import { buildParagraphReference } from '@shared/types';
import { buildBibleWmbLink } from '@shared/wmb-link';
import type {
    AiToolDefinition,
    BiblePassageToolResponse,
    BibleSearchToolResponse,
    BibleVerseResult,
    BibleVersionOption,
} from './types';
import { validateLanguage } from './shared';
import { encodeSearchCursor, parseSearchCursor } from './search-pagination';

const BIBLE_SEARCH_LIMIT_SCHEMA = z.number().int().min(1).max(40);

const bibleSearchCursorSchema = z.object({
    kind: z.literal('searchBible'),
    query: z.string().min(3),
    languageCode: z.string().min(1),
    abbreviation: z.string().min(1),
    testament: z.enum(['O', 'N']).optional(),
    limit: BIBLE_SEARCH_LIMIT_SCHEMA,
    offset: z.number().int().min(0),
});

type BibleSearchPage = z.infer<typeof bibleSearchCursorSchema>;

function resolveBibleSearchPage(input: {
    query?: string;
    testament?: 'O' | 'N';
    limit?: number;
    cursor?: string;
    languageCode: string;
    abbreviation: string;
}): BibleSearchPage | { error: string } {
    const limit = input.limit ?? 20;

    if (!input.cursor) {
        const query = input.query?.trim();
        if (!query || query.length < 3) {
            return {
                error: 'A query of at least 3 characters is required when no cursor is provided.',
            };
        }
        return {
            kind: 'searchBible',
            query,
            languageCode: input.languageCode,
            abbreviation: input.abbreviation,
            testament: input.testament,
            limit,
            offset: 0,
        };
    }

    const parsed = parseSearchCursor(input.cursor, bibleSearchCursorSchema);
    if ('error' in parsed) {
        return { error: parsed.error };
    }

    const page = parsed.value;
    const explicitQuery = input.query?.trim();
    if (explicitQuery && explicitQuery !== page.query) {
        return { error: 'The provided query does not match the pagination cursor.' };
    }
    if (input.testament && input.testament !== page.testament) {
        return { error: 'The provided testament does not match the pagination cursor.' };
    }
    if (input.limit && input.limit !== page.limit) {
        return { error: 'The provided limit does not match the pagination cursor.' };
    }
    if (input.abbreviation !== page.abbreviation) {
        return { error: 'The provided Bible version does not match the pagination cursor.' };
    }

    return page;
}

function resolveBibleVersion(
    languageCode: string,
    abbreviation?: string,
): aiBibleRepo.ResolvedBibleVersion | { error: string } {
    const version = aiBibleRepo.resolveBibleVersion(abbreviation, languageCode);
    if (version) {
        return version;
    }

    return {
        error: `No Bible found${abbreviation ? ` for abbreviation "${abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
    };
}

function toBibleVerseResult(verse: BibleBook, bibleVersionAbbreviation: string): BibleVerseResult {
    return {
        bookCode: verse.book,
        bookName: verse.bookName,
        chapter: verse.chapter,
        verse: verse.verse,
        testament: verse.testament,
        bibleVersionAbbreviation,
        content: verse.content,
        wmbUrl: buildBibleWmbLink({
            type: 'bible',
            bookCode: verse.book,
            chapter: verse.chapter,
            verse: verse.verse,
            bibleVersionAbbreviation,
            bookName: verse.bookName,
        }),
    };
}

function toBiblePassageResponse(
    verses: BibleBook[],
    bibleVersionAbbreviation: string,
): BiblePassageToolResponse {
    const [first] = verses;
    const last = verses[verses.length - 1];

    return {
        bookCode: first.book,
        bookName: first.bookName,
        chapter: first.chapter,
        fromVerse: first.verse,
        toVerse: last.verse,
        bibleVersionAbbreviation,
        verseCount: verses.length,
        verses: verses.map((verse) => toBibleVerseResult(verse, bibleVersionAbbreviation)),
    };
}

function lookupBiblePassage(input: {
    book: string;
    chapter: string;
    fromVerse?: string;
    toVerse?: string;
    languageCode: string;
    abbreviation?: string;
}): BiblePassageToolResponse | { error: string } {
    const resolvedVersion = resolveBibleVersion(input.languageCode, input.abbreviation);
    if ('error' in resolvedVersion) {
        return resolvedVersion;
    }

    const passage = aiBibleRepo.getPassage({
        book: input.book,
        chapter: input.chapter,
        fromVerse: input.fromVerse,
        toVerse: input.toVerse,
        abbreviation: resolvedVersion.abbreviation,
        languageCode: resolvedVersion.languageCode,
    });
    if ('error' in passage) {
        return passage;
    }

    return toBiblePassageResponse(passage, resolvedVersion.abbreviation);
}

export function buildBibleTools(
    defaultContentLanguage: string,
    defaultAbbreviation?: string,
): Record<string, AiToolDefinition> {
    return {
        getBibleVersions: {
            description:
                'List Bible versions available for a language or the current active version.',
            inputSchema: z.object({ languageCode: z.string().optional() }),
            execute: async ({ languageCode }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;
                const versions = aiBibleRepo.getAvailableVersions(lang);
                if ('error' in versions) {
                    return versions;
                }
                return versions.map((version): BibleVersionOption => ({
                    abbreviation: version.abbreviation,
                    languageCode: version.languageCode,
                    name: version.name,
                }));
            },
        },
        getBiblePassage: {
            description:
                'Retrieve Bible verses. Provide the book name as it appears in the Bible ' +
                '(e.g. "Genesis", "Revelation", "Jean", "Matthieu", "Apocalypse"). ' +
                'Provide chapter and verse numbers as digits. ' +
                'Use getBibleVersions first to find available abbreviations if needed. ' +
                'Returns verse objects with exact link fields and wmbUrl for markdown reference links.',
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
            execute: async ({ languageCode, abbreviation, ...rest }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) return langError;
                return lookupBiblePassage({
                    ...rest,
                    abbreviation: abbreviation ?? defaultAbbreviation,
                    languageCode: lang,
                });
            },
        },
        searchBible: {
            description:
                'Full-text search across Bible verses. Returns matching verses ranked by relevance. ' +
                'Use this to find verses containing specific words or phrases. ' +
                'Returns clean citation fields and wmbUrl for markdown reference links. ' +
                'If nextCursor is returned, pass it back to continue from the next page instead of repeating page one.',
            inputSchema: z
                .object({
                    query: z.string().min(3).optional().describe('Search query (min 3 characters)'),
                    testament: z
                        .enum(['O', 'N'])
                        .optional()
                        .describe('Filter by testament: "O" (Old) or "N" (New)'),
                    abbreviation: z.string().optional().describe('Bible version abbreviation'),
                    languageCode: z.string().optional(),
                    limit: BIBLE_SEARCH_LIMIT_SCHEMA.optional().describe(
                        'Max results (default 20, max 40)',
                    ),
                    cursor: z
                        .string()
                        .min(1)
                        .optional()
                        .describe('Pagination cursor returned by a previous searchBible call'),
                })
                .refine((value) => Boolean(value.query || value.cursor), {
                    message: 'Either query or cursor is required.',
                    path: ['query'],
                }),
            execute: async ({ languageCode, abbreviation, query, testament, limit, cursor }) => {
                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) {
                    return langError;
                }

                const resolvedVersion = resolveBibleVersion(
                    lang,
                    abbreviation ?? defaultAbbreviation,
                );
                if ('error' in resolvedVersion) {
                    return resolvedVersion;
                }

                const page = resolveBibleSearchPage({
                    query,
                    testament,
                    limit,
                    cursor,
                    languageCode: lang,
                    abbreviation: resolvedVersion.abbreviation,
                });
                if ('error' in page) {
                    return page;
                }

                const result = aiBibleRepo.searchVerses({
                    query: page.query,
                    testament: page.testament,
                    limit: page.limit,
                    offset: page.offset,
                    abbreviation: resolvedVersion.abbreviation,
                    languageCode: resolvedVersion.languageCode,
                });
                if ('error' in result) {
                    return result;
                }

                const results = result.data.map((entry) =>
                    toBibleVerseResult(entry.item, resolvedVersion.abbreviation),
                );
                // An empty page never advances the offset, so it must not hand back a cursor.
                const hasMore = results.length > 0 && page.offset + results.length < result.total;
                const nextPage: BibleSearchPage = {
                    ...page,
                    offset: page.offset + results.length,
                };

                const response: BibleSearchToolResponse = {
                    query: result.query,
                    bibleVersionAbbreviation: resolvedVersion.abbreviation,
                    total: result.total,
                    returned: results.length,
                    hasMore,
                    results,
                    nextCursor: hasMore ? encodeSearchCursor(nextPage) : undefined,
                };

                return response;
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
            execute: async ({ subjectId: rawSubjectId, languageCode, abbreviation, ...rest }) => {
                const subjectId = rawSubjectId.trim();
                if (!subjectsRepo.exists(subjectId)) {
                    return { error: `Subject "${subjectId}" not found.` };
                }

                const lang = languageCode ?? defaultContentLanguage;
                const langError = validateLanguage(lang);
                if (langError) {
                    return langError;
                }

                const resolvedAbbreviation = abbreviation ?? defaultAbbreviation;
                if (!resolvedAbbreviation) {
                    return { error: 'Aucune version biblique active disponible.' };
                }

                const result = lookupBiblePassage({
                    ...rest,
                    abbreviation: resolvedAbbreviation,
                    languageCode: lang,
                });
                if ('error' in result) {
                    return result;
                }

                const verse = result.verses[0];
                if (!verse) {
                    return {
                        error: 'Passage biblique introuvable.',
                    };
                }

                const title = `${verse.bookName} ${verse.chapter}`;
                const bibleContent = result.verses
                    .map((v) => {
                        return `${v.bookName} ${v.chapter}:${v.verse} ${v.content}`;
                    })
                    .join(' ');

                const item = subjectsRepo.createItem(
                    subjectId,
                    title,
                    buildParagraphReference(
                        {
                            documentType: 'bible',
                            bibleBook: verse.bookCode,
                            bibleChapter: verse.chapter,
                            bibleVersionAbbreviation: result.bibleVersionAbbreviation,
                        },
                        0,
                        lang,
                    ),
                    bibleContent,
                    {
                        kind: 'bible-verse',
                        bibleVerse: {
                            id: `${verse.bookCode}:${verse.chapter}:${verse.verse}:${verse.bibleVersionAbbreviation}`,
                            bookName: verse.bookName,
                            book: verse.bookCode,
                            testament: verse.testament,
                            chapter: verse.chapter,
                            verse: verse.verse,
                            content: verse.content,
                        },
                    },
                );

                return { referenceId: item.id, subjectId, documentTitle: title };
            },
        },
    };
}
