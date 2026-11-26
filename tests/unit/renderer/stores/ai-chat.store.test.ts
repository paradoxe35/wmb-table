import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessageHistoryPage, AiSendMessageResult } from '@shared/ai.types';
import { AI_MESSAGE_HISTORY_PAGE_SIZE } from '@shared/ai.types';
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

describe('ai-chat.store queue behavior', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('batches pending messages and sends them after the active response completes', async () => {
        const { store, listeners, sendMessageMock } = await createHarness();

        await store.getState().sendMessage('first question');
        await flushAsync();
        await store.getState().sendMessage('second question');
        await store.getState().sendMessage('third question');

        expect(sendMessageMock).toHaveBeenCalledTimes(1);
        expect(store.getState().queuedMessagesByConversation['conv-1']).toHaveLength(2);

        const firstGenerationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamComplete?.({
            conversationId: 'conv-1',
            generationId: firstGenerationId,
            messageId: 'assistant-1',
        });
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(sendMessageMock.mock.calls[1][0].messages).toEqual([
            'second question',
            'third question',
        ]);
        expect(store.getState().queuedMessagesByConversation['conv-1']).toBeUndefined();
    });

    it('continues with the pending queue after the active response is canceled', async () => {
        const { store, listeners, sendMessageMock } = await createHarness();

        await store.getState().sendMessage('first question');
        await flushAsync();
        await store.getState().sendMessage('queued follow-up');

        const firstGenerationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamCancel?.({
            conversationId: 'conv-1',
            generationId: firstGenerationId,
            messageId: 'assistant-1',
        });
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(sendMessageMock.mock.calls[1][0].messages).toEqual(['queued follow-up']);
    });

    it('continues with the pending queue after the active response fails', async () => {
        const { store, listeners, sendMessageMock } = await createHarness();

        await store.getState().sendMessage('first question');
        await flushAsync();
        await store.getState().sendMessage('queued after failure');

        const firstGenerationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamError?.({
            conversationId: 'conv-1',
            generationId: firstGenerationId,
            messageId: 'assistant-1',
            error: 'failure',
        });
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(sendMessageMock.mock.calls[1][0].messages).toEqual(['queued after failure']);
        expect(
            store.getState().messagesByConversation['conv-1'].some((m) => m.id === 'assistant-1'),
        ).toBe(false);
    });

    it('ignores stale stream events from an older run', async () => {
        const { store, listeners, sendMessageMock } = await createHarness();

        await store.getState().sendMessage('first question');
        await flushAsync();

        const currentGenerationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamChunk?.({
            conversationId: 'conv-1',
            generationId: 'stale-run',
            messageId: 'assistant-1',
            delta: 'stale text',
        });

        expect(
            store
                .getState()
                .messagesByConversation['conv-1'].find((message) => message.id === 'assistant-1')
                ?.content,
        ).toBe('');

        listeners.aiStreamChunk?.({
            conversationId: 'conv-1',
            generationId: currentGenerationId,
            messageId: 'assistant-1',
            delta: 'live text',
        });

        expect(
            store
                .getState()
                .messagesByConversation['conv-1'].find((message) => message.id === 'assistant-1')
                ?.content,
        ).toBe('live text');
    });

    it('keeps the user message if cancellation wins the race before send confirmation returns', async () => {
        const deferred = createDeferred<AiSendMessageResult>();
        const { store, listeners, sendMessageMock } = await createHarness({
            sendMessageImpl: async (_request) => deferred.promise,
        });

        await store.getState().sendMessage('race condition question');
        await flushAsync();

        const generationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamCancel?.({
            conversationId: 'conv-1',
            generationId,
            messageId: 'assistant-1',
        });
        await flushAsync();

        deferred.resolve(
            createSendResult(
                {
                    conversationId: 'conv-1',
                    messages: ['race condition question'],
                    generationId,
                },
                1,
            ),
        );
        await flushAsync();

        const messages = store.getState().messagesByConversation['conv-1'];
        expect(
            messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
            })),
        ).toEqual([{ id: 'user-1-1', role: 'user', content: 'race condition question' }]);
    });

    it('allows removing a queued message before it is sent', async () => {
        const { store, listeners, sendMessageMock } = await createHarness();

        await store.getState().sendMessage('first question');
        await flushAsync();
        await store.getState().sendMessage('remove me');

        const queuedMessageId = store.getState().queuedMessagesByConversation['conv-1'][0].id;
        store.getState().removeQueuedMessage('conv-1', queuedMessageId);

        const firstGenerationId = sendMessageMock.mock.calls[0][0].generationId;
        listeners.aiStreamComplete?.({
            conversationId: 'conv-1',
            generationId: firstGenerationId,
            messageId: 'assistant-1',
        });
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(1);
        expect(store.getState().queuedMessagesByConversation['conv-1']).toBeUndefined();
    });

    it('does not reload messages when the already active conversation is clicked again', async () => {
        const { store, getMessagesPageMock } = await createHarness({
            getMessagesPageImpl: async () => createHistoryPage([], { totalCount: 0 }),
        });

        store.setState({
            activeConversationId: 'conv-1',
            messagesByConversation: {
                'conv-1': [
                    createMessage({
                        id: 'user-existing',
                        conversationId: 'conv-1',
                        role: 'user',
                        content: 'already loaded',
                    }),
                ],
            },
        });

        await store.getState().selectConversation('conv-1');

        expect(getMessagesPageMock).not.toHaveBeenCalled();
    });

    it('refreshAfterSync reloads the cached active conversation from the database', async () => {
        const conversation = createConversation({
            id: 'conv-1',
            title: 'Synced conversation',
            updatedAt: '2026-04-09T10:00:00.000Z',
        });
        const syncedMessage = createMessage({
            id: 'synced-message',
            conversationId: conversation.id,
            role: 'assistant',
            content: 'remote content',
        });
        const { store, getConversationsPageMock, getMessagesPageMock } = await createHarness({
            getMessagesPageImpl: async () => createHistoryPage([syncedMessage]),
        });

        getConversationsPageMock.mockResolvedValue(createConversationHistoryPage([conversation]));
        store.setState({
            conversations: [createConversation({ title: 'Stale conversation' })],
            activeConversationId: conversation.id,
            messagesByConversation: {
                [conversation.id]: [
                    createMessage({
                        id: 'stale-message',
                        conversationId: conversation.id,
                        role: 'assistant',
                        content: 'stale content',
                    }),
                ],
            },
        });

        await store.getState().refreshAfterSync();

        expect(store.getState().conversations[0].title).toBe('Synced conversation');
        expect(store.getState().messagesByConversation[conversation.id]).toEqual([syncedMessage]);
        expect(getMessagesPageMock).toHaveBeenCalledWith({
            conversationId: conversation.id,
            limit: AI_MESSAGE_HISTORY_PAGE_SIZE,
            loadedCount: 0,
        });
    });

    it('keeps the local assistant placeholder when conversation history finishes loading after send', async () => {
        const deferredPage = createDeferred<AiMessageHistoryPage>();
        const conversation = createConversation({ id: 'conv-2', title: 'Second' });
        const { store, sendMessageMock } = await createHarness({
            getMessagesPageImpl: async (request) =>
                request.conversationId === 'conv-2'
                    ? deferredPage.promise
                    : createHistoryPage([], { totalCount: 0 }),
            sendMessageImpl: async (request, index) =>
                createSendResult(request, index, conversation),
        });

        store.setState((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: 'conv-1',
            messagesByConversation: {
                ...state.messagesByConversation,
                'conv-2': [],
            },
        }));

        const selectPromise = store.getState().selectConversation('conv-2');
        await flushAsync();

        const sendAccepted = await store.getState().sendMessage('question on second conversation');
        expect(sendAccepted).toBe(true);
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(1);
        expect(
            store
                .getState()
                .messagesByConversation['conv-2'].some((message) => message.id === 'assistant-1'),
        ).toBe(true);

        deferredPage.resolve(createHistoryPage([], { totalCount: 0 }));
        await selectPromise;
        await flushAsync();

        const messages = store.getState().messagesByConversation['conv-2'];
        expect(messages.map((message) => message.id)).toEqual(['user-1-1', 'assistant-1']);
    });

    it('loads all messages at once for small conversations', async () => {
        const smallConversation = createConversation({ id: 'conv-2', title: 'Small' });
        const storedMessages = Array.from({ length: 12 }, (_, index) =>
            createMessage({
                id: `msg-${index + 1}`,
                conversationId: smallConversation.id,
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `message ${index + 1}`,
                createdAt: `2026-04-08T10:${String(index).padStart(2, '0')}:00.000Z`,
            }),
        );
        const { store, getMessagesPageMock } = await createHarness({
            getMessagesPageImpl: async (request) => {
                expect(request).toEqual({
                    conversationId: smallConversation.id,
                    limit: AI_MESSAGE_HISTORY_PAGE_SIZE,
                    loadedCount: 0,
                });
                return createHistoryPage(storedMessages, { totalCount: storedMessages.length });
            },
        });

        store.setState((state) => ({
            conversations: [smallConversation, ...state.conversations],
        }));

        await store.getState().selectConversation(smallConversation.id);

        expect(getMessagesPageMock).toHaveBeenCalledTimes(1);
        expect(store.getState().messagesByConversation[smallConversation.id]).toEqual(
            storedMessages,
        );
        expect(store.getState().historyByConversation[smallConversation.id]).toEqual({
            loadedCount: 12,
            hasMore: false,
        });
    });

    it('prepends older messages when the user requests more history', async () => {
        const conversation = createConversation({ id: 'conv-2', title: 'Paged' });
        const pageSize = AI_MESSAGE_HISTORY_PAGE_SIZE;
        const allMessages = Array.from({ length: 120 }, (_, index) =>
            createMessage({
                id: `msg-${index + 1}`,
                conversationId: conversation.id,
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `message ${index + 1}`,
                createdAt: `2026-04-08T10:${String(index).padStart(2, '0')}:00.000Z`,
            }),
        );
        const { store, getMessagesPageMock } = await createHarness({
            getMessagesPageImpl: async (request) => {
                if (request.loadedCount === 0) {
                    return createHistoryPage(allMessages.slice(allMessages.length - pageSize), {
                        loadedCount: pageSize,
                        totalCount: 120,
                        hasMore: true,
                    });
                }

                if (request.loadedCount === pageSize) {
                    return createHistoryPage(
                        allMessages.slice(
                            allMessages.length - pageSize * 2,
                            allMessages.length - pageSize,
                        ),
                        {
                            loadedCount: pageSize * 2,
                            totalCount: 120,
                            hasMore: true,
                        },
                    );
                }

                if (request.loadedCount === pageSize * 2) {
                    return createHistoryPage(
                        allMessages.slice(
                            allMessages.length - pageSize * 3,
                            allMessages.length - pageSize * 2,
                        ),
                        {
                            loadedCount: pageSize * 3,
                            totalCount: 120,
                            hasMore: true,
                        },
                    );
                }

                if (request.loadedCount === pageSize * 3) {
                    return createHistoryPage(
                        allMessages.slice(0, allMessages.length - pageSize * 3),
                        {
                            loadedCount: 120,
                            totalCount: 120,
                            hasMore: false,
                        },
                    );
                }

                throw new Error(`Unexpected loadedCount ${request.loadedCount}`);
            },
        });

        store.setState((state) => ({
            conversations: [conversation, ...state.conversations],
        }));

        await store.getState().selectConversation(conversation.id);
        await store.getState().loadOlderMessages(conversation.id);
        await store.getState().loadOlderMessages(conversation.id);
        await store.getState().loadOlderMessages(conversation.id);

        expect(getMessagesPageMock.mock.calls.map(([request]) => request.loadedCount)).toEqual([
            0,
            pageSize,
            pageSize * 2,
            pageSize * 3,
        ]);
        expect(store.getState().messagesByConversation[conversation.id]).toHaveLength(120);
        expect(store.getState().messagesByConversation[conversation.id][0]?.id).toBe('msg-1');
        expect(store.getState().messagesByConversation[conversation.id][119]?.id).toBe('msg-120');
        expect(store.getState().historyByConversation[conversation.id]).toEqual({
            loadedCount: 120,
            hasMore: false,
        });
    });

    it('does not start overlapping older-history loads for the same conversation', async () => {
        const deferredPage = createDeferred<AiMessageHistoryPage>();
        const conversation = createConversation({ id: 'conv-2', title: 'Paged' });
        const pageSize = AI_MESSAGE_HISTORY_PAGE_SIZE;
        const { store, getMessagesPageMock } = await createHarness({
            getMessagesPageImpl: async (request) => {
                if (request.loadedCount === 0) {
                    return createHistoryPage(
                        [
                            createMessage({
                                id: 'msg-81',
                                conversationId: conversation.id,
                                role: 'user',
                                content: 'message 81',
                            }),
                        ],
                        {
                            loadedCount: pageSize,
                            totalCount: 120,
                            hasMore: true,
                        },
                    );
                }

                return deferredPage.promise;
            },
        });

        store.setState((state) => ({
            conversations: [conversation, ...state.conversations],
        }));

        await store.getState().selectConversation(conversation.id);

        const firstLoad = store.getState().loadOlderMessages(conversation.id);
        const secondLoad = store.getState().loadOlderMessages(conversation.id);
        await flushAsync();

        expect(getMessagesPageMock).toHaveBeenCalledTimes(2);

        deferredPage.resolve(
            createHistoryPage([], {
                loadedCount: pageSize,
                totalCount: 120,
                hasMore: true,
            }),
        );

        await Promise.all([firstLoad, secondLoad]);
    });
});

describe('ai-chat.store run events', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    async function startRun() {
        const harness = await createHarness();
        await harness.store.getState().sendMessage('Qui t’a dit que tu étais nu ?');
        await flushAsync();
        const generationId = harness.sendMessageMock.mock.calls[0][0].generationId;
        const event = { conversationId: 'conv-1', generationId, messageId: 'assistant-1' };
        const toolResults = () =>
            harness.store
                .getState()
                .messagesByConversation['conv-1'].find((m) => m.id === 'assistant-1')
                ?.toolResults ?? [];
        return { ...harness, event, toolResults };
    }

    it('keeps a tool that returned { error } as failed and does not reload notes', async () => {
        const { listeners, event, toolResults } = await startRun();

        listeners.aiToolCallComplete?.({
            ...event,
            toolName: 'editNote',
            toolCallId: 'call-1',
            payload: { error: 'anchor not found' },
            isError: true,
        });

        expect(toolResults()).toEqual([
            {
                toolCallId: 'call-1',
                name: 'editNote',
                output: { error: 'anchor not found' },
                isError: true,
            },
        ]);
        expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    it('treats a failed sub-agent step as failed even without the flag', async () => {
        const { listeners, event, toolResults } = await startRun();

        listeners.aiToolCallComplete?.({
            ...event,
            toolName: 'researchTopic:searchSermons',
            toolCallId: 'call-2',
            payload: { error: 'Language "fr" is not installed.' },
        });

        expect(toolResults()[0]?.isError).toBe(true);
    });

    it('reloads notes after a successful note edit', async () => {
        const { listeners, event, toolResults } = await startRun();

        listeners.aiToolCallComplete?.({
            ...event,
            toolName: 'editNote',
            toolCallId: 'call-3',
            payload: { noteId: 'n1', replacements: 1 },
            isError: false,
        });

        expect(toolResults()[0]?.isError).toBe(false);
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('ignores the outcome of a stale run', async () => {
        const { store, listeners, event } = await startRun();

        listeners.aiStreamComplete?.({
            ...event,
            generationId: 'old-generation',
            messageId: 'assistant-old',
            outcome: {
                finishReason: 'length',
                stoppedBy: 'model',
                truncated: true,
                stepLimitReached: false,
                steps: 1,
                continuations: 2,
            },
        });

        expect(store.getState().runNoticeByConversation['conv-1']).toBeUndefined();
        expect(store.getState().conversationRuns['conv-1']).toBeDefined();
    });
});
