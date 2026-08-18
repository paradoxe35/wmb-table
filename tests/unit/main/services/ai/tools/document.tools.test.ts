import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCustomDocumentsMock = vi.fn();
const getCustomDocumentContentMock = vi.fn();
const searchCustomDocumentsMock = vi.fn();

vi.mock('@main/database/repositories/custom-documents.repository', () => ({
    getCustomDocuments: getCustomDocumentsMock,
    getCustomDocumentContent: getCustomDocumentContentMock,
    searchCustomDocuments: searchCustomDocumentsMock,
}));

describe('document.tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('searches custom documents with snippets and pagination', async () => {
        getCustomDocumentsMock.mockReturnValue([
            { id: 'doc-1', title: 'Open Book Notes', languageCode: 'en' },
            { id: 'doc-2', title: 'Faith Study', languageCode: 'en' },
        ]);
        searchCustomDocumentsMock.mockImplementation(({ offset }: { offset: number }) => {
            if (offset === 0) {
                return {
                    query: 'open book',
                    mode: 'all',
                    totalDocuments: 2,
                    returned: 1,
                    hasMore: true,
                    results: [
                        {
                            documentId: 'doc-1',
                            title: 'Open Book Notes',
                            languageCode: 'en',
                            totalMatches: 2,
                            matches: [
                                { lineIndex: 0, snippet: 'The open book is mentioned here.' },
                            ],
                        },
                    ],
                };
            }

            return {
                query: 'open book',
                mode: 'all',
                totalDocuments: 2,
                returned: 1,
                hasMore: false,
                results: [
                    {
                        documentId: 'doc-2',
                        title: 'Faith Study',
                        languageCode: 'en',
                        totalMatches: 1,
                        matches: [{ lineIndex: 0, snippet: 'Faith and the open book are linked.' }],
                    },
                ],
            };
        });

        const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
        const tools = buildDocumentTools();

        const first = (await tools.searchCustomDocuments.execute({
            query: 'open book',
            mode: 'all',
            limit: 1,
        })) as {
            query: string;
            mode: string;
            totalDocuments: number;
            returned: number;
            hasMore: boolean;
            nextCursor?: string;
            results: Array<{
                documentId: string;
                title: string;
                wmbUrl: string;
                matches: Array<{ lineIndex: number; snippet: string }>;
                totalMatches: number;
            }>;
        };

        expect(first.query).toBe('open book');
        expect(first.mode).toBe('all');
        expect(first.totalDocuments).toBe(2);
        expect(first.returned).toBe(1);
        expect(first.hasMore).toBe(true);
        expect(first.results[0].documentId).toBe('doc-1');
        expect(first.results[0].wmbUrl).toBe('wmb://doc/doc-1/Open%20Book%20Notes');
        expect(first.results[0].totalMatches).toBe(2);
        expect(first.results[0].matches[0].lineIndex).toBe(0);
        expect(first.results[0].matches[0].snippet).toContain('open book');

        const second = (await tools.searchCustomDocuments.execute({
            cursor: first.nextCursor,
        })) as {
            returned: number;
            hasMore: boolean;
            results: Array<{ documentId: string }>;
        };

        expect(second.returned).toBe(1);
        expect(second.hasMore).toBe(false);
        expect(second.results[0].documentId).toBe('doc-2');
    });

    it('returns an empty result when documents exist but no matches are found', async () => {
        getCustomDocumentsMock.mockReturnValue([{ id: 'doc-1', title: 'One', languageCode: 'en' }]);
        searchCustomDocumentsMock.mockReturnValue({
            query: 'faith',
            mode: 'exact',
            totalDocuments: 0,
            returned: 0,
            hasMore: false,
            results: [],
        });

        const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
        const tools = buildDocumentTools();

        await expect(
            tools.searchCustomDocuments.execute({
                query: 'faith',
            }),
        ).resolves.toMatchObject({
            query: 'faith',
            totalDocuments: 0,
            returned: 0,
            hasMore: false,
            results: [],
        });
    });

    it('names the document the way every other document field names it', async () => {
        getCustomDocumentContentMock.mockResolvedValue({
            id: 'doc-1',
            title: 'Open Book Notes',
            languageCode: 'en',
            content: 'line one\nline two',
            internalRevision: 7,
        });

        const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
        const tools = buildDocumentTools();

        const result = (await tools.getCustomDocumentContent.execute({
            documentId: 'doc-1',
        })) as Record<string, unknown>;

        expect(result.documentId).toBe('doc-1');
        expect(result).not.toHaveProperty('id');
        // The repository row is not the tool contract: extra columns must not leak to the model.
        expect(result).not.toHaveProperty('internalRevision');
        expect(result.wmbUrl).toContain('doc-1');
    });

    it('returns an error when there are no custom documents', async () => {
        getCustomDocumentsMock.mockReturnValue([]);

        const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
        const tools = buildDocumentTools();

        await expect(
            tools.searchCustomDocuments.execute({
                query: 'faith',
            }),
        ).resolves.toEqual({ error: 'No custom documents found.' });
    });
});
