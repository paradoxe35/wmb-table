import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@shared/ai.types';

const getRecentMessagesMock = vi.fn();
const logInfoMock = vi.fn();

vi.mock('@main/database/repositories/ai.repository', () => ({
    getRecentMessages: getRecentMessagesMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: {
        info: logInfoMock,
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('context-memory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('limits recent tool-result count and truncates verbose tool content', async () => {
        const verboseResults = Array.from({ length: 6 }, (_, index) => ({
            toolCallId: `tool-${index}`,
            name: 'getCustomDocumentContent',
            output: {
                title: `Document ${index + 1}`,
                content: 'A'.repeat(600),
            },
        }));

        const messages: AiMessage[] = [
            {
                id: 'assistant-1',
                conversationId: 'conv-1',
                role: 'assistant',
                content: 'Synthese en cours',
                toolCalls: [],
                toolResults: verboseResults,
                createdAt: new Date().toISOString(),
            },
        ];

        getRecentMessagesMock.mockReturnValue(messages);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-1', true);
        const recent = context.recentMessages[0]?.content ?? '';

        expect((recent.match(/\[Tool\]/g) ?? []).length).toBe(4);
        expect(recent).toContain('Document 1');
        expect(recent).not.toContain('Document 5');
        expect(recent.length).toBeLessThan(1600);
    });

    it('summarizes paginated search results with lower-bound totals and continuation hint', async () => {
        const messages: AiMessage[] = [
            {
                id: 'assistant-2',
                conversationId: 'conv-2',
                role: 'assistant',
                content: 'Recherche terminee',
                toolCalls: [],
                toolResults: [
                    {
                        toolCallId: 'search-1',
                        name: 'searchContent',
                        output: {
                            results: [
                                { title: 'Titre 1', sermonId: '1' },
                                { title: 'Titre 2', sermonId: '2' },
                            ],
                            totalSermons: 120,
                            totalIsExact: false,
                            hasMore: true,
                        },
                    },
                ],
                createdAt: new Date().toISOString(),
            },
        ];

        getRecentMessagesMock.mockReturnValue(messages);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-2', false);
        const recent = context.recentMessages[0]?.content ?? '';

        expect(recent).toContain('at least 120');
        expect(recent).toContain('more available');
        expect(recent).toContain('Titre 1');
    });
});
