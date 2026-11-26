// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@shared/ai.types';
import { useAiChatStore } from '@renderer/stores/ai-chat.store';
import { useRunNoticeActions } from '@renderer/views/options/ai-chat/use-run-notice-actions';

const sendMessage = vi.fn(async () => true);
const retryLastUserMessage = vi.fn(async () => true);
const flushQueuedMessages = vi.fn(async () => true);

function message(id: string, role: AiMessage['role'], content: string): AiMessage {
    return {
        id,
        conversationId: 'conv-1',
        role,
        content,
        toolCalls: [],
        toolResults: [],
        createdAt: '2026-11-26T10:00:00.000Z',
    };
}

function pressRetry(): void {
    renderHook(() => useRunNoticeActions('conv-1')).result.current('retry');
}

describe('useRunNoticeActions retry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAiChatStore.setState({
            sendMessage,
            retryLastUserMessage,
            flushQueuedMessages,
            messagesByConversation: {
                'conv-1': [message('u0', 'user', 'Qui ?'), message('a0', 'assistant', 'Moïse.')],
            },
            queuedMessagesByConversation: {
                'conv-1': [{ id: 'q1', content: "l'amour", createdAt: '2026-11-26T10:01:00.000Z' }],
            },
            runNoticeByConversation: {
                'conv-1': {
                    kind: 'error',
                    messageId: null,
                    code: null,
                    retryable: null,
                    detail: 'Aucune langue sélectionnée.',
                },
            },
        });
    });

    it('sends the refused batch again without a Continue prompt', () => {
        pressRetry();

        expect(flushQueuedMessages).toHaveBeenCalledWith('conv-1');
        expect(sendMessage).not.toHaveBeenCalled();
        expect(retryLastUserMessage).not.toHaveBeenCalled();
    });

    it('continues the cut answer when nothing waits in the queue', () => {
        useAiChatStore.setState({ queuedMessagesByConversation: {} });

        pressRetry();

        expect(flushQueuedMessages).not.toHaveBeenCalled();
        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('reruns the question of a run that failed after it started', () => {
        useAiChatStore.setState({
            messagesByConversation: { 'conv-1': [message('u0', 'user', 'Qui ?')] },
            runNoticeByConversation: {
                'conv-1': {
                    kind: 'error',
                    messageId: 'a0',
                    code: 'network',
                    retryable: true,
                    detail: 'fetch failed',
                },
            },
        });

        pressRetry();

        expect(retryLastUserMessage).toHaveBeenCalledWith('conv-1', 'u0');
        expect(flushQueuedMessages).not.toHaveBeenCalled();
    });
});
