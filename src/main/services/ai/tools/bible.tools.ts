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
import { parsePassageRange } from './bible-passage-range';
import { validateLanguage } from './shared';
import { encodeSearchCursor, ensureSameField, parseSearchCursor } from './search-pagination';

const BIBLE_SEARCH_LIMIT_SCHEMA = z.number().int().min(1).max(40);

const bibleSearchCursorSchema = z.object({
    kind: z.literal('searchBible'),
    query: z.string().min(3),
    abbreviation: z.string().min(1),
    testament: z.enum(['O', 'N']).optional(),
    limit: BIBLE_SEARCH_LIMIT_SCHEMA,
    offset: z.number().int().min(0),
});

type BibleSearchPage = z.infer<typeof bibleSearchCursorSchema>;

function parseBibleSearchCursor(cursor: string): BibleSearchPage | { error: string } {
    const parsed = parseSearchCursor(cursor, bibleSearchCursorSchema);
    return 'error' in parsed ? { error: parsed.error } : parsed.value;
}

/** The cursor keeps its own version, so a search started on a non-active version continues there. */
function resolveBibleSearchPage(input: {
    query?: string;
    testament?: 'O' | 'N';
    limit?: number;
    continued?: BibleSearchPage;
    explicitAbbreviation?: string;
    abbreviation: string;
}): BibleSearchPage | { error: string } {
    const { continued } = input;

    if (!continued) {
        const query = input.query?.trim();
        if (!query || query.length < 3) {
            return {
                error: 'A query of at least 3 characters is required when no cursor is provided.',
            };
        }
        return {
            kind: 'searchBible',
            query,
            abbreviation: input.abbreviation,
            testament: input.testament,
            limit: input.limit ?? 20,
            offset: 0,
        };
    }

    const mismatch =
        ensureSameField('query', input.query?.trim() || undefined, continued.query) ??
        ensureSameField('testament', input.testament, continued.testament) ??
        ensureSameField('limit', input.limit, continued.limit) ??
        ensureSameField('Bible version', input.explicitAbbreviation, continued.abbreviation);

    return mismatch ?? continued;
}

interface VersionRequest {
    abbreviation?: string;
    languageCode?: string;
}

interface VersionDefaults {
    languageCode: string;
    abbreviation?: string;
}

function resolveRequestedVersion(
    request: VersionRequest,
    defaults: VersionDefaults,
): aiBibleRepo.ResolvedBibleVersion | { error: string } {
    const languageCode = request.languageCode ?? defaults.languageCode;
    const langError = validateLanguage(languageCode);
    if (langError) return langError;

    const abbreviation = request.abbreviation ?? defaults.abbreviation;
    return (
        aiBibleRepo.resolveBibleVersion(abbreviation, languageCode) ?? {
            error: `No Bible found${abbreviation ? ` for abbreviation "${abbreviation}"` : ''}. Use getBibleVersions to find available versions.`,
        }
    );
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

/**
 * One name per concept, matching the field names every Bible result returns, so a model
 * carrying a result forward sends back exactly what it was given.
 */
const BOOK_CODE_SCHEMA = z
    .string()
    .describe('Book code from a Bible result (e.g. "43N"). A book name ("Jean") also resolves.');

const BIBLE_VERSION_SCHEMA = z
    .string()
    .optional()
    .describe('Bible version abbreviation from a Bible result (e.g. "lsg")');

interface PassageLookup {
    verses: BibleBook[];
    bibleVersionAbbreviation: string;
}

function lookupBiblePassage(
    input: {
        book: string;
        chapter: string;
        fromVerse?: string;
        toVerse?: string;
    },
    version: VersionRequest,
    defaults: VersionDefaults,
): PassageLookup | { error: string } {
    const range = parsePassageRange(input);
    if ('error' in range) {
        return range;
    }

    const resolvedVersion = resolveRequestedVersion(version, defaults);
    if ('error' in resolvedVersion) {
        return resolvedVersion;
    }

    const verses = aiBibleRepo.getPassage({
        book: input.book,
        chapter: range.chapter,
        verses: range.verses,
        abbreviation: resolvedVersion.abbreviation,
        languageCode: resolvedVersion.languageCode,
    });
    if ('error' in verses) {
        return verses;
    }

    return { verses, bibleVersionAbbreviation: resolvedVersion.abbreviation };
}

/** Psalm 119 alone is 176 verses; one call must not flood the model's context. */
const MAX_PASSAGE_VERSES = 40;

type BiblePassagePage = BiblePassageToolResponse & {
    hasMore?: true;
    nextFromVerse?: string;
    nextToVerse?: string;
};

function toBiblePassagePage({ verses, bibleVersionAbbreviation }: PassageLookup): BiblePassagePage {
    const response = toBiblePassageResponse(
        verses.slice(0, MAX_PASSAGE_VERSES),
        bibleVersionAbbreviation,
    );
    const next = verses[MAX_PASSAGE_VERSES];
    if (!next) return response;

    return {
        ...response,
        hasMore: true,
        nextFromVerse: next.verse,
        nextToVerse: verses[verses.length - 1].verse,
    };
}

export function buildBibleTools(
    defaultContentLanguage: string,
    defaultAbbreviation?: string,
): Record<string, AiToolDefinition> {
    const defaults: VersionDefaults = {
        languageCode: defaultContentLanguage,
        abbreviation: defaultAbbreviation,
    };

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
                    bibleVersionAbbreviation: version.abbreviation,
                    languageCode: version.languageCode,
                    name: version.name,
                }));
            },
        },
        getBiblePassage: {
            description:
                'Retrieve Bible verses. Pass the bookCode returned by an earlier Bible result ' +
                '(e.g. "43N"); a book name as written in the Bible ("Jean", "Apocalypse") also works. ' +
                'Provide chapter and verse numbers as digits. ' +
                'Use getBibleVersions first to find available versions if needed. ' +
                `Returns at most ${MAX_PASSAGE_VERSES} verses; when hasMore is true, call again with fromVerse = nextFromVerse and toVerse = nextToVerse. ` +
                'Returns verse objects with exact link fields and wmbUrl for markdown reference links.',
            inputSchema: z.object({
                bookCode: BOOK_CODE_SCHEMA,
                chapter: z.string().describe('Chapter number (e.g. "3")'),
                fromVerse: z
                    .string()
                    .optional()
                    .describe('Starting verse number (e.g. "16"). Omit for the whole chapter.'),
                toVerse: z
                    .string()
                    .optional()
                    .describe('Ending verse number (e.g. "18"). Requires fromVerse.'),
                bibleVersionAbbreviation: BIBLE_VERSION_SCHEMA,
                languageCode: z.string().optional(),
            }),
            execute: async ({ languageCode, bibleVersionAbbreviation, bookCode, ...rest }) => {
                const passage = lookupBiblePassage(
                    { ...rest, book: bookCode },
                    { abbreviation: bibleVersionAbbreviation, languageCode },
                    defaults,
                );
                return 'error' in passage ? passage : toBiblePassagePage(passage);
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
                    bibleVersionAbbreviation: BIBLE_VERSION_SCHEMA,
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
            execute: async ({
                languageCode,
                bibleVersionAbbreviation,
                query,
                testament,
                limit,
                cursor,
            }) => {
                const continued = cursor ? parseBibleSearchCursor(cursor) : undefined;
                if (continued && 'error' in continued) {
                    return continued;
                }

                const resolvedVersion = resolveRequestedVersion(
                    {
                        abbreviation: continued?.abbreviation ?? bibleVersionAbbreviation,
                        languageCode,
                    },
                    defaults,
                );
                if ('error' in resolvedVersion) {
                    return resolvedVersion;
                }

                const page = resolveBibleSearchPage({
                    query,
                    testament,
                    limit,
                    continued,
                    explicitAbbreviation: bibleVersionAbbreviation,
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
                bibleVersionAbbreviation: BIBLE_VERSION_SCHEMA,
                languageCode: z.string().optional(),
                bookCode: BOOK_CODE_SCHEMA,
                chapter: z.string(),
                fromVerse: z.string(),
                toVerse: z.string().optional(),
            }),
            execute: async ({
                subjectId: rawSubjectId,
                languageCode,
                bibleVersionAbbreviation,
                bookCode,
                ...rest
            }) => {
                const subjectId = rawSubjectId.trim();
                if (!subjectsRepo.exists(subjectId)) {
                    return { error: `Subject "${subjectId}" not found.` };
                }

                const lang = languageCode ?? defaultContentLanguage;
                const passage = lookupBiblePassage(
                    { ...rest, book: bookCode },
                    { abbreviation: bibleVersionAbbreviation, languageCode },
                    defaults,
                );
                if ('error' in passage) {
                    return passage;
                }

                const result = toBiblePassageResponse(
                    passage.verses,
                    passage.bibleVersionAbbreviation,
                );

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
