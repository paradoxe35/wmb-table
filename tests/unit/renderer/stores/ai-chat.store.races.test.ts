import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConversation, AiMessageHistoryPage, AiSendMessageResult } from '@shared/ai.types';
import {
    createConversation,
    createConversationHistoryPage,
    createDeferred,
    createHarness,
    createHistoryPage,
    createMessage,
    createSendResult,
    flushAsync,
} from './ai-chat-store-harness';

vi.mock('@renderer/lib/feature-reminders', () => ({ markFeatureReminderUsed: vi.fn() }));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

function messageIds(harness: { store: { getState(): { messagesByConversation: object } } }) {
    const messages = harness.store.getState().messagesByConversation as Record<
        string,
        { id: string }[]
    >;
    return (conversationId: string) => messages[conversationId]?.map((message) => message.id);
}

describe('sync refresh during a send (R1)', () => {
    async function refreshThatLandsLater() {
        const page = createDeferred<AiMessageHistoryPage>();
        const harness = await createHarness({ getMessagesPageImpl: () => page.promise });
        harness.getConversationsPageMock.mockResolvedValue(
            createConversationHistoryPage([createConversation()]),
        );
        const refresh = harness.store.getState().refreshAfterSync();
        await flushAsync();
        expect(harness.getMessagesPageMock).toHaveBeenCalledTimes(1);
        return { ...harness, page, refresh };
    }

    it('keeps the live run messages when the older snapshot lands', async () => {
        const harness = await refreshThatLandsLater();
        await harness.store.getState().sendMessage('question');
        await flushAsync();
        const generationId = harness.sendMessageMock.mock.calls[0][0].generationId;
        const event = { conversationId: 'conv-1', generationId, messageId: 'assistant-1' };

        harness.page.resolve(createHistoryPage([]));
        await harness.refresh;
        harness.listeners.aiStreamChunk?.({ ...event, delta: 'Réponse' });
        harness.listeners.aiStreamComplete?.(event);

        const state = harness.store.getState();
        expect(messageIds(harness)('conv-1')).toEqual(['user-1-1', 'assistant-1']);
        expect(state.messagesByConversation['conv-1'][1].content).toBe('Réponse');
        expect(state.runNoticeByConversation['conv-1']).toBeUndefined();
    });

    it('keeps an answer that finished before the older snapshot lands', async () => {
        const harness = await refreshThatLandsLater();
        await harness.store.getState().sendMessage('question');
        await flushAsync();
        const generationId = harness.sendMessageMock.mock.calls[0][0].generationId;
        const event = { conversationId: 'conv-1', generationId, messageId: 'assistant-1' };
        harness.listeners.aiStreamChunk?.({ ...event, delta: 'Réponse' });
        harness.listeners.aiStreamComplete?.(event);

        harness.page.resolve(createHistoryPage([]));
        await harness.refresh;

        expect(messageIds(harness)('conv-1')).toEqual(['user-1-1', 'assistant-1']);
    });

    it('keeps a message queued while the snapshot was loading', async () => {
        const harness = await refreshThatLandsLater();
        const blocked = createDeferred<AiSendMessageResult>();
        harness.sendMessageMock.mockImplementationOnce(() => blocked.promise);
        await harness.store.getState().sendMessage('première');
        await harness.store.getState().sendMessage('seconde');

        harness.page.resolve(createHistoryPage([]));
        await harness.refresh;

        expect(harness.store.getState().queuedMessagesByConversation['conv-1']).toHaveLength(1);
        expect(harness.store.getState().conversationRuns['conv-1']?.status).toBe('starting');
    });
});

describe('main moves a starting run to a new conversation (R2)', () => {
    async function moveWhileStarting() {
        const replaced = createConversation({ id: 'conv-new' });
        const firstSend = createDeferred<AiSendMessageResult>();
        let sends = 0;
        const harness = await createHarness({
            sendMessageImpl: (request, index) => {
                sends += 1;
                return sends === 1
                    ? firstSend.promise
                    : Promise.resolve(createSendResult(request, index, replaced));
            },
        });
        await harness.store.getState().sendMessage('première');
        await flushAsync();
        await harness.store.getState().sendMessage('seconde, pendant le démarrage');
        const request = harness.sendMessageMock.mock.calls[0][0];
        firstSend.resolve(createSendResult(request, 1, replaced));
        await flushAsync();
        const event = {
            conversationId: 'conv-new',
            generationId: request.generationId,
            messageId: 'assistant-1',
        };
        return { ...harness, event };
    }

    it('moves the queue and sends it once the moved run ends', async () => {
        const harness = await moveWhileStarting();
        expect(harness.store.getState().queuedMessagesByConversation).toEqual({
            'conv-new': [expect.objectContaining({ content: 'seconde, pendant le démarrage' })],
        });

        harness.listeners.aiStreamChunk?.({ ...harness.event, delta: 'x' });
        harness.listeners.aiStreamComplete?.(harness.event);
        await flushAsync();

        expect(harness.sendMessageMock).toHaveBeenCalledTimes(2);
        expect(harness.sendMessageMock.mock.calls[1][0]).toMatchObject({
            conversationId: 'conv-new',
            messages: ['seconde, pendant le démarrage'],
        });
    });

    it('drops the caches and the list entry of the old id', async () => {
        const harness = await moveWhileStarting();
        const state = harness.store.getState();

        expect(state.messagesByConversation['conv-1']).toBeUndefined();
        expect(state.historyByConversation['conv-1']).toBeUndefined();
        expect(state.conversations.map((conversation) => conversation.id)).toEqual(['conv-new']);
        expect(state.activeConversationId).toBe('conv-new');
    });

    it('moves a notice recorded under the old id', async () => {
        const replaced = createConversation({ id: 'conv-new' });
        const firstSend = createDeferred<AiSendMessageResult>();
        const harness = await createHarness({ sendMessageImpl: () => firstSend.promise });
        await harness.store.getState().sendMessage('première');
        await flushAsync();
        harness.store.setState((state) => ({
            runNoticeByConversation: {
                ...state.runNoticeByConversation,
                'conv-1': { kind: 'stopped', messageId: 'a0' },
            },
        }));

        firstSend.resolve(createSendResult(harness.sendMessageMock.mock.calls[0][0], 1, replaced));
        await flushAsync();

        expect(harness.store.getState().runNoticeByConversation).toEqual({
            'conv-new': { kind: 'stopped', messageId: 'a0' },
        });
    });
});

describe('retry after main deleted the trailing answer rows (R4)', () => {
    it('drops a tool-only answer left from the failed attempt', async () => {
        const harness = await createHarness();
        harness.store.setState({
            messagesByConversation: {
                'conv-1': [
                    createMessage({ id: 'u1', conversationId: 'conv-1', role: 'user' }),
                    createMessage({
                        id: 'a-old',
                        conversationId: 'conv-1',
                        role: 'assistant',
                        toolCalls: [{ id: 't1', name: 'searchSermons', input: {} }],
                    }),
                ],
            },
            reasoningByMessage: { 'a-old': 'pensée' },
        });

        expect(await harness.store.getState().retryLastUserMessage('conv-1', 'u1')).toBe(true);

        const state = harness.store.getState();
        expect(messageIds(harness)('conv-1')).toEqual(['u1', 'assistant-retry']);
        expect(state.historyByConversation['conv-1'].loadedCount).toBe(2);
        expect(state.reasoningByMessage['a-old']).toBeUndefined();
    });

    it('keeps the old rows when main refuses the retry', async () => {
        const harness = await createHarness({
            retryMessageImpl: async () => {
                throw new Error('Aucun fournisseur configuré.');
            },
        });
        harness.store.setState({
            messagesByConversation: {
                'conv-1': [
                    createMessage({ id: 'u1', conversationId: 'conv-1', role: 'user' }),
                    createMessage({ id: 'a-old', conversationId: 'conv-1', role: 'assistant' }),
                ],
            },
        });

        expect(await harness.store.getState().retryLastUserMessage('conv-1', 'u1')).toBe(false);
        expect(messageIds(harness)('conv-1')).toEqual(['u1', 'a-old']);
    });
});

describe('sending while the conversation is being deleted (R7)', () => {
    it('refuses the send so the delete cannot wipe the new run', async () => {
        const harness = await createHarness();
        const deleted = createDeferred<void>();
        const deleteMock = vi.mocked(window.api.ai.deleteConversation);
        deleteMock.mockImplementationOnce(() => deleted.promise);

        const deleting = harness.store.getState().deleteConversation('conv-1');
        const accepted = await harness.store.getState().sendMessage('question');
        deleted.resolve();
        await deleting;
        await flushAsync();

        expect(accepted).toBe(false);
        expect(harness.sendMessageMock).not.toHaveBeenCalled();
        expect(harness.store.getState().conversationRuns).toEqual({});
        expect(harness.store.getState().error).toBeTruthy();
    });

    it('forgets the deleted conversation everywhere', async () => {
        const harness = await createHarness();
        const second = createConversation({ id: 'conv-2', title: 'Second' });
        harness.store.setState({
            conversations: [createConversation(), second],
            conversationList: { loadedCount: 2, totalCount: 3, hasMore: true },
            messagesByConversation: {
                'conv-1': [createMessage({ id: 'u1', conversationId: 'conv-1', role: 'user' })],
            },
            reasoningByMessage: { u1: 'pensée' },
            runNoticeByConversation: { 'conv-1': { kind: 'empty', messageId: 'a1' } },
        });

        await harness.store.getState().deleteConversation('conv-1');

        const state = harness.store.getState();
        expect(state.conversations).toEqual([second]);
        expect(state.conversationList).toEqual({ loadedCount: 1, totalCount: 2, hasMore: true });
        expect(state.messagesByConversation['conv-1']).toBeUndefined();
        expect(state.reasoningByMessage).toEqual({});
        expect(state.runNoticeByConversation).toEqual({});
        expect(state.activeConversationId).toBeNull();
    });

    it('accepts sends again once the delete failed', async () => {
        const harness = await createHarness();
        vi.mocked(window.api.ai.deleteConversation).mockRejectedValueOnce(new Error('DB locked'));

        await harness.store.getState().deleteConversation('conv-1');

        expect(await harness.store.getState().sendMessage('question')).toBe(true);
    });
});

describe('first conversation created after the user switched away', () => {
    it('stays on the conversation the user opened meanwhile', async () => {
        const created = createDeferred<AiConversation>();
        const other = createConversation({ id: 'conv-other', title: 'Autre' });
        const harness = await createHarness({
            createConversationImpl: () => created.promise,
            sendMessageImpl: async (request, index) => createSendResult(request, index),
        });
        harness.store.setState({
            activeConversationId: null,
            conversations: [other],
            messagesByConversation: { [other.id]: [] },
        });

        const sending = harness.store.getState().sendMessage('première');
        await harness.store.getState().selectConversation(other.id);
        created.resolve(createConversation({ id: 'conv-fresh' }));
        expect(await sending).toBe(true);
        await flushAsync();

        expect(harness.store.getState().activeConversationId).toBe(other.id);
        expect(harness.sendMessageMock.mock.calls[0][0].conversationId).toBe('conv-fresh');
    });
});
