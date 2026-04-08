import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@shared/ai.types';

const getRecentMessagesMock = vi.fn();

vi.mock('@main/database/repositories/ai.repository', () => ({
    getRecentMessages: getRecentMessagesMock,
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('tokenx', () => ({
    estimateTokenCount: (text: string) => Math.ceil(text.length / 4),
}));

describe('context-memory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads only the most recent 40 messages from the repository', async () => {
        getRecentMessagesMock.mockReturnValue([]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        buildConversationContext('conv-0', false);

        expect(getRecentMessagesMock).toHaveBeenCalledWith('conv-0', 40);
    });

    it('includes raw tool JSON for recent (non-compact) messages', async () => {
        const messages: AiMessage[] = [
            {
                id: 'assistant-1',
                conversationId: 'conv-1',
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
        const context = buildConversationContext('conv-1', false);
        const recent = context.recentMessages[0]?.content ?? '';

        expect(recent).toContain('[Tool:searchContent]');
        expect(recent).toContain('Titre 1');
        expect(recent).toContain('Titre 2');
        expect(recent).toContain('"totalSermons":120');
        expect(recent).toContain('"hasMore":true');
        // nextCursor should be stripped
        expect(recent).not.toContain('nextCursor');
    });

    it('truncates full paragraph content in getSermonContent for recent messages', async () => {
        const messages: AiMessage[] = [
            {
                id: 'assistant-2',
                conversationId: 'conv-2',
                role: 'assistant',
                content: 'Voici le contenu',
                toolCalls: [],
                toolResults: [
                    {
                        toolCallId: 'content-1',
                        name: 'getSermonContent',
                        output: {
                            meta: { sermonId: '65-0429B', title: 'The Rapture', translationId: 3 },
                            paragraphs: [
                                { paragraphNumber: 0, content: 'X'.repeat(500) },
                                { paragraphNumber: 1, content: 'Y'.repeat(500) },
                            ],
                            totalParagraphs: 120,
                            startParagraph: 0,
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

        expect(recent).toContain('[Tool:getSermonContent]');
        expect(recent).toContain('The Rapture');
        expect(recent).toContain('"paragraphNumber":0');
        // Full 500-char content should be truncated
        expect(recent).not.toContain('X'.repeat(500));
        expect(recent.length).toBeLessThan(1000);
    });

    it('compacts older messages into summary when exceeding token budget', async () => {
        const messages: AiMessage[] = Array.from({ length: 20 }, (_, i) => ({
            id: `msg-${i}`,
            conversationId: 'conv-3',
            role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
            content: 'A'.repeat(800),
            toolCalls: [],
            toolResults: [],
            createdAt: new Date(Date.now() + i * 1000).toISOString(),
        }));

        getRecentMessagesMock.mockReturnValue(messages);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-3', true);

        expect(context.summary).not.toBeNull();
        expect(context.recentMessages.length).toBeGreaterThan(0);
        expect(context.recentMessages.length).toBeLessThan(messages.length);
    });
});
