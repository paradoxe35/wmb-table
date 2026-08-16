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

const LARGE_BUDGET = 1_000_000;

function textMessage(
    id: string,
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
): AiMessage {
    return {
        id,
        conversationId,
        role,
        content,
        toolCalls: [],
        toolResults: [],
        createdAt: new Date().toISOString(),
    };
}

describe('context-memory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads only the most recent 40 messages from the repository', async () => {
        getRecentMessagesMock.mockReturnValue([]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        buildConversationContext('conv-0', LARGE_BUDGET);

        expect(getRecentMessagesMock).toHaveBeenCalledWith('conv-0', 40);
    });

    it('keeps markdown line structure in recent messages', async () => {
        const markdown = '# Titre\n\n- premier point\n- second point\n\nConclusion.';
        getRecentMessagesMock.mockReturnValue([
            textMessage('assistant-md', 'conv-md', 'assistant', markdown),
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-md', LARGE_BUDGET);

        expect(context.recentMessages[0]?.content).toBe(markdown);
    });

    it('collapses repeated spacing without joining lines together', async () => {
        getRecentMessagesMock.mockReturnValue([
            textMessage('assistant-ws', 'conv-ws', 'assistant', 'Ligne   une  \n\n\n\nLigne deux'),
        ]);

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-ws', LARGE_BUDGET);

        expect(context.recentMessages[0]?.content).toBe('Ligne une\n\nLigne deux');
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
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-3', 3_000);

        expect(context.summary).not.toBeNull();
        expect(context.recentMessages.length).toBeGreaterThan(0);
        expect(context.recentMessages.length).toBeLessThan(20);
    });

    // Each message is 800 chars (200 mocked tokens); compacted user turns cost 100 and
    // assistant turns 125. The summary ships in the system prompt of the same request, so
    // compacting a message only frees the difference rather than its full cost.
    it('charges the compacted summary against the same token budget', async () => {
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-4', 3_000);

        expect(context.recentMessages).toHaveLength(8);
        expect(context.recentTokenCount).toBe(1_600);
        expect(context.historyTokenCount).toBe(4_000);
    });

    it('keeps the minimum recent turns even with no budget left', async () => {
        getRecentMessagesMock.mockReturnValue(buildLongConversation());

        const { buildConversationContext } = await import('@main/services/ai/context-memory');
        const context = buildConversationContext('conv-5', 0);

        expect(context.recentMessages).toHaveLength(8);
        expect(context.summary).not.toBeNull();
    });
});

function buildLongConversation(): AiMessage[] {
    return Array.from({ length: 20 }, (_, index) =>
        textMessage(
            `msg-${index}`,
            'conv-long',
            index % 2 === 0 ? 'user' : 'assistant',
            'A'.repeat(800),
        ),
    );
}
