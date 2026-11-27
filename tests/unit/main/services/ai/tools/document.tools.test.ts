import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCustomDocumentsMock = vi.fn();
const getCustomDocumentContentMock = vi.fn();
const searchCustomDocumentsMock = vi.fn();

vi.mock('@main/database/repositories/custom-documents.repository', async (importOriginal) => ({
    toDocumentLines: (
        await importOriginal<
            typeof import('@main/database/repositories/custom-documents.repository')
        >()
    ).toDocumentLines,
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

    it('lists an empty library as an empty list rather than an error', async () => {
        getCustomDocumentsMock.mockReturnValue([]);

        const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');

        await expect(buildDocumentTools().getCustomDocuments.execute({})).resolves.toEqual([]);
    });

    describe('search cursor', () => {
        beforeEach(() => {
            getCustomDocumentsMock.mockReturnValue([{ id: 'doc-1', title: 'One' }]);
            searchCustomDocumentsMock.mockReturnValue({
                query: 'la foi',
                mode: 'exact',
                totalDocuments: 30,
                returned: 2,
                hasMore: true,
                results: [],
            });
        });

        async function firstCursor() {
            const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
            const tools = buildDocumentTools();
            const first = (await tools.searchCustomDocuments.execute({
                query: 'la foi',
                limit: 2,
            })) as { nextCursor: string };
            return { tools, cursor: first.nextCursor };
        }

        it('continues from the offset the cursor carries', async () => {
            const { tools, cursor } = await firstCursor();

            await tools.searchCustomDocuments.execute({ cursor });

            expect(searchCustomDocumentsMock).toHaveBeenLastCalledWith({
                query: 'la foi',
                mode: 'exact',
                limit: 2,
                offset: 2,
            });
        });

        it.each([
            ['query', { query: 'autre chose' }],
            ['mode', { mode: 'any' }],
            ['limit', { limit: 5 }],
        ])('refuses a %s that does not match the cursor', async (label, override) => {
            const { tools, cursor } = await firstCursor();

            await expect(
                tools.searchCustomDocuments.execute({ cursor, ...override }),
            ).resolves.toEqual({
                error: `The provided ${label} does not match the pagination cursor.`,
            });
        });

        it('refuses a cursor from another tool', async () => {
            const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
            const foreign = Buffer.from(
                JSON.stringify({ kind: 'searchContent', query: 'la foi', offset: 2 }),
            ).toString('base64url');

            await expect(
                buildDocumentTools().searchCustomDocuments.execute({ cursor: foreign }),
            ).resolves.toEqual({ error: 'Invalid pagination cursor.' });
        });
    });

    describe('getCustomDocumentContent size budget', () => {
        type ContentPage = {
            content: string;
            startLine: number;
            returnedLines: number;
            totalLines: number;
            hasMore: boolean;
            nextStartLine?: number;
            lineTruncated?: boolean;
        };

        async function read(lines: string[], input: Record<string, unknown> = {}) {
            getCustomDocumentContentMock.mockResolvedValue({
                id: 'doc-1',
                title: 'Livre',
                languageCode: 'fr',
                content: JSON.stringify(lines),
            });
            const { buildDocumentTools } = await import('@main/services/ai/tools/document.tools');
            return (await buildDocumentTools().getCustomDocumentContent.execute({
                documentId: 'doc-1',
                ...input,
            })) as ContentPage;
        }

        it('stops before a page of long paragraphs exceeds the budget', async () => {
            const lines = Array.from({ length: 40 }, (_, i) => `${i}:${'é'.repeat(1000)}`);

            const page = await read(lines, { maxLines: 100 });

            expect(page.content.length).toBeLessThanOrEqual(12_000);
            expect(page.returnedLines).toBeLessThan(40);
            expect(page).toMatchObject({ hasMore: true, nextStartLine: page.returnedLines });
        });

        it('reads the whole document page by page with no gap or repeat', async () => {
            const lines = Array.from({ length: 40 }, (_, i) => `${i}:${'a'.repeat(1000)}`);

            const seen: string[] = [];
            let page = await read(lines, { maxLines: 100 });
            seen.push(...page.content.split('\n'));
            while (page.hasMore) {
                page = await read(lines, { maxLines: 100, startLine: page.nextStartLine });
                seen.push(...page.content.split('\n'));
            }

            expect(seen).toEqual(lines);
            expect(page.nextStartLine).toBeUndefined();
        });

        it('cuts a single paragraph longer than the budget and says so', async () => {
            const page = await read(['x'.repeat(50_000), 'suite']);

            expect(page.content).toHaveLength(12_000);
            expect(page).toMatchObject({
                returnedLines: 1,
                lineTruncated: true,
                hasMore: true,
                nextStartLine: 1,
            });
        });

        it('keeps the line limit for short lines', async () => {
            const page = await read(['un', 'deux', 'trois'], { maxLines: 2 });

            expect(page).toMatchObject({
                content: 'un\ndeux',
                returnedLines: 2,
                hasMore: true,
                nextStartLine: 2,
            });
            expect(page.lineTruncated).toBeUndefined();
        });

        it('returns nothing past the end of the document', async () => {
            const page = await read(['un', 'deux'], { startLine: 10 });

            expect(page).toMatchObject({ content: '', returnedLines: 0, hasMore: false });
        });
    });
});
