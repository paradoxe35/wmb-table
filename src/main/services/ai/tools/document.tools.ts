import { z } from 'zod';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import type { SearchMode } from '@shared/types';
import { buildDocWmbLink } from '@shared/wmb-link';
import type { AiToolDefinition, CustomDocumentSearchToolResponse } from './types';
import {
    encodeSearchCursor,
    ensureSameField,
    parseSearchCursor,
    searchLimitSchema,
    toolSearchLimitSchema,
} from './search-pagination';

const customDocumentSearchCursorSchema = z.object({
    kind: z.literal('searchCustomDocuments'),
    query: z.string().min(2),
    mode: z.enum(['exact', 'all', 'any']),
    limit: searchLimitSchema,
    offset: z.number().int().min(0),
});

const customDocumentSearchInputSchema = z
    .object({
        query: z.string().min(2).optional(),
        mode: z.enum(['exact', 'all', 'any']).optional(),
        limit: toolSearchLimitSchema,
        cursor: z.string().min(1).optional(),
    })
    .refine((value) => Boolean(value.query || value.cursor), {
        message: 'Either query or cursor is required.',
        path: ['query'],
    });

type CustomDocumentSearchCursor = z.infer<typeof customDocumentSearchCursorSchema>;

function resolveSearchPage(input: {
    query?: string;
    mode?: SearchMode;
    limit?: number;
    cursor?: string;
}): Omit<CustomDocumentSearchCursor, 'kind'> | { error: string } {
    const explicitQuery = input.query?.trim() || undefined;

    if (!input.cursor) {
        if (!explicitQuery || explicitQuery.length < 2) {
            return { error: 'A query is required when no cursor is provided.' };
        }
        return {
            query: explicitQuery,
            mode: input.mode ?? 'exact',
            limit: input.limit ?? 10,
            offset: 0,
        };
    }

    const parsed = parseSearchCursor(input.cursor, customDocumentSearchCursorSchema);
    if ('error' in parsed) return parsed;

    const { query, mode, limit, offset } = parsed.value;
    const mismatch =
        ensureSameField('query', explicitQuery, query) ??
        ensureSameField('mode', input.mode, mode) ??
        ensureSameField('limit', input.limit, limit);
    return mismatch ?? { query, mode, limit, offset };
}

export function buildDocumentTools(): Record<string, AiToolDefinition> {
    return {
        getCustomDocuments: {
            description:
                'List user-imported custom documents (PDF, text files, etc.). Each document includes wmbUrl for markdown reference links. ' +
                'An empty list means the user has not imported any document.',
            inputSchema: z.object({}),
            execute: async () => {
                return customDocsRepo.getCustomDocuments().map((d) => ({
                    documentId: d.id,
                    title: d.title,
                    wmbUrl: buildDocWmbLink({
                        type: 'doc',
                        documentId: d.id,
                        title: d.title,
                    }),
                }));
            },
        },
        searchCustomDocuments: {
            description:
                'Search inside user-imported custom documents by text. ' +
                'Returns matching documents with line snippets and wmbUrl for markdown reference links. ' +
                'Use this before getCustomDocumentContent when you need to find where a topic appears in custom documents. ' +
                'Mode controls precision: "exact" for phrase-like matching, "all" for all words in any order, "any" for broader exploration. ' +
                'If nextCursor is returned, pass it back to continue from the next page instead of repeating page one.',
            inputSchema: customDocumentSearchInputSchema,
            execute: async ({ query, mode, limit, cursor }) => {
                const page = resolveSearchPage({ query, mode, limit, cursor });
                if ('error' in page) return page;

                if (customDocsRepo.getCustomDocuments().length === 0) {
                    return { error: 'No custom documents found.' };
                }

                const result = customDocsRepo.searchCustomDocuments({
                    query: page.query,
                    mode: page.mode,
                    limit: page.limit,
                    offset: page.offset,
                });

                const hasMore = result.hasMore;

                const response: CustomDocumentSearchToolResponse = {
                    ...result,
                    results: result.results.map((item) => ({
                        ...item,
                        wmbUrl: buildDocWmbLink({
                            type: 'doc',
                            documentId: item.documentId,
                            title: item.title,
                        }),
                    })),
                    hasMore,
                    nextCursor: hasMore
                        ? encodeSearchCursor({
                              kind: 'searchCustomDocuments',
                              query: result.query,
                              mode: result.mode,
                              limit: page.limit,
                              offset: page.offset + result.returned,
                          } satisfies CustomDocumentSearchCursor)
                        : undefined,
                };

                return response;
            },
        },
        getCustomDocumentContent: {
            description:
                'Retrieve the text content of a custom document by its id. ' +
                'Supports pagination via startLine and maxLines to avoid loading the entire document at once. ' +
                'Includes wmbUrl for markdown reference links.',
            inputSchema: z.object({
                documentId: z.string(),
                startLine: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe('Line offset to start from (default 0)'),
                maxLines: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe('Maximum number of lines to return (default 50, max 100)'),
            }),
            execute: async ({ documentId: rawDocumentId, startLine = 0, maxLines = 50 }) => {
                const documentId = rawDocumentId.trim();
                const doc = await customDocsRepo.getCustomDocumentContent(documentId);
                if (!doc) return { error: `Document "${documentId}" not found.` };
                if (!doc.content) return { error: 'Document has no text content.' };

                const lines = customDocsRepo.toDocumentLines(doc.content);
                const totalLines = lines.length;
                const slice = lines.slice(startLine, startLine + maxLines).join('\n');

                return {
                    documentId: doc.id,
                    title: doc.title,
                    languageCode: doc.languageCode,
                    wmbUrl: buildDocWmbLink({
                        type: 'doc',
                        documentId: doc.id,
                        title: doc.title,
                    }),
                    content: slice,
                    totalLines,
                    startLine,
                    returnedLines: Math.max(0, Math.min(maxLines, totalLines - startLine)),
                };
            },
        },
    };
}
