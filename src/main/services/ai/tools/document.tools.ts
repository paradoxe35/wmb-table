import { z } from 'zod';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';
import type { SearchMode } from '@shared/types';
import { buildDocWmbLink } from '@shared/wmb-link';
import type { AiToolDefinition, CustomDocumentSearchToolResponse } from './types';

const SEARCH_LIMIT_SCHEMA = z.number().int().min(1).max(20);

const customDocumentSearchCursorSchema = z.object({
    kind: z.literal('searchCustomDocuments'),
    query: z.string().min(2),
    mode: z.enum(['exact', 'all', 'any']),
    limit: SEARCH_LIMIT_SCHEMA,
    offset: z.number().int().min(0),
});

const customDocumentSearchInputSchema = z
    .object({
        query: z.string().min(2).optional(),
        mode: z.enum(['exact', 'all', 'any']).optional(),
        limit: SEARCH_LIMIT_SCHEMA.optional(),
        cursor: z.string().min(1).optional(),
    })
    .refine((value) => Boolean(value.query || value.cursor), {
        message: 'Either query or cursor is required.',
        path: ['query'],
    });

function toDocumentLines(content: string): string[] {
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return parsed.map((line) => String(line));
        }
    } catch {
        // Stored content can also be plain text.
    }

    return content.split('\n');
}

function encodeCursor(payload: z.infer<typeof customDocumentSearchCursorSchema>): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function resolveSearchPage(input: {
    query?: string;
    mode?: SearchMode;
    limit?: number;
    cursor?: string;
}): { query: string; mode: SearchMode; limit: number; offset: number } | { error: string } {
    const limit = input.limit ?? 10;
    const mode = input.mode ?? 'exact';

    if (!input.cursor) {
        const query = input.query?.trim();
        if (!query || query.length < 2) {
            return { error: 'A query is required when no cursor is provided.' };
        }
        return { query, mode, limit, offset: 0 };
    }

    try {
        const parsed = customDocumentSearchCursorSchema.safeParse(
            JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
        );
        if (!parsed.success) {
            return { error: 'Invalid pagination cursor.' };
        }

        const cursor = parsed.data;
        const explicitQuery = input.query?.trim();
        if (explicitQuery && explicitQuery !== cursor.query) {
            return { error: 'The provided query does not match the pagination cursor.' };
        }
        if (input.mode && input.mode !== cursor.mode) {
            return { error: 'The provided mode does not match the pagination cursor.' };
        }
        if (input.limit && input.limit !== cursor.limit) {
            return { error: 'The provided limit does not match the pagination cursor.' };
        }

        return {
            query: cursor.query,
            mode: cursor.mode,
            limit: cursor.limit,
            offset: cursor.offset,
        };
    } catch {
        return { error: 'Invalid pagination cursor.' };
    }
}

export function buildDocumentTools(): Record<string, AiToolDefinition> {
    return {
        getCustomDocuments: {
            description:
                'List user-imported custom documents (PDF, text files, etc.). Each document includes wmbUrl for markdown reference links.',
            inputSchema: z.object({}),
            execute: async () => {
                const docs = customDocsRepo.getCustomDocuments();
                if (docs.length === 0) return { error: 'No custom documents found.' };
                return docs.map((d) => ({
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
                        ? encodeCursor({
                              kind: 'searchCustomDocuments',
                              query: result.query,
                              mode: result.mode,
                              limit: page.limit,
                              offset: page.offset + result.returned,
                          })
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

                const lines = toDocumentLines(doc.content);
                const totalLines = lines.length;
                const slice = lines.slice(startLine, startLine + maxLines).join('\n');

                return {
                    ...doc,
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
