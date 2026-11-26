import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiRetryMessageResult, AiRunOutcome, AiSendMessageResult } from '@shared/ai.types';
import { AI_MESSAGE_MAX_LENGTH } from '@shared/ai.types';
import {
    createConversation,
    createConversationHistoryPage,
    createDeferred,
    createHarness,
    createMessage,
    createSendResult,
    flushAsync,
    type HarnessOptions,
} from './ai-chat-store-harness';

vi.mock('@renderer/lib/feature-reminders', () => ({ markFeatureReminderUsed: vi.fn() }));

const SECOND = createConversation({ id: 'conv-2', title: 'Second' });

const COMPLETE_OUTCOME: AiRunOutcome = {
    finishReason: 'stop',
    stoppedBy: 'model',
    truncated: false,
    stepLimitReached: false,
    steps: 2,
    continuations: 0,
};

function messagesOf(count: number, conversationId: string) {
    return Array.from({ length: count }, (_, index) =>
        createMessage({
            id: `old-${index}`,
            conversationId,
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `message ${index}`,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        }),
    );
}

async function harnessWithSecondConversation(options?: HarnessOptions) {
    const harness = await createHarness(options);
    harness.store.setState((state) => ({
        conversations: [...state.conversations, SECOND],
        messagesByConversation: { ...state.messagesByConversation, [SECOND.id]: [] },
    }));
    return harness;
}

async function startRun(options?: HarnessOptions) {
    const harness = await harnessWithSecondConversation(options);
    await harness.store.getState().sendMessage('Qui t’a dit que tu étais nu ?');
    await flushAsync();
    const generationId = harness.sendMessageMock.mock.calls[0][0].generationId;
    const event = { conversationId: 'conv-1', generationId, messageId: 'assistant-1' };
    return { ...harness, event };
}

function giveAnswerText(harness: Awaited<ReturnType<typeof startRun>>, text: string): void {
    harness.listeners.aiStreamChunk?.({ ...harness.event, delta: text });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('switching conversations during a run (U1)', () => {
    it('stays on the conversation the user switched to when the send result arrives', async () => {
        const deferred = createDeferred<AiSendMessageResult>();
        const { store, sendMessageMock } = await harnessWithSecondConversation({
            sendMessageImpl: () => deferred.promise,
        });

        await store.getState().sendMessage('première question');
        await flushAsync();
        await store.getState().selectConversation(SECOND.id);
        deferred.resolve(createSendResult(sendMessageMock.mock.calls[0][0], 1));
        await flushAsync();

        expect(store.getState().activeConversationId).toBe(SECOND.id);
        expect(store.getState().conversationRuns['conv-1']?.status).toBe('streaming');
    });

    it('is not pulled back when a queued message is sent after the user left', async () => {
        const { store, listeners, sendMessageMock } = await harnessWithSecondConversation();

        await store.getState().sendMessage('première question');
        await flushAsync();
        await store.getState().sendMessage('question en attente');
        await store.getState().selectConversation(SECOND.id);
        listeners.aiStreamComplete?.({
            conversationId: 'conv-1',
            generationId: sendMessageMock.mock.calls[0][0].generationId,
            messageId: 'assistant-1',
        });
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(store.getState().activeConversationId).toBe(SECOND.id);
    });

    it('follows the id main gives when the user is still on the conversation', async () => {
        const replaced = createConversation({ id: 'conv-new' });
        const { store } = await createHarness({
            sendMessageImpl: async (request, index) => createSendResult(request, index, replaced),
        });

        await store.getState().sendMessage('bonjour');
        await flushAsync();

        expect(store.getState().activeConversationId).toBe('conv-new');
    });

    it('stays on the other conversation when a retry result arrives', async () => {
        const deferred = createDeferred<AiRetryMessageResult>();
        const { store, retryMessageMock } = await harnessWithSecondConversation({
            retryMessageImpl: () => deferred.promise,
        });
        store.setState((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                'conv-1': [createMessage({ id: 'u1', conversationId: 'conv-1', role: 'user' })],
            },
        }));

        const retried = store.getState().retryLastUserMessage('conv-1', 'u1');
        await flushAsync();
        await store.getState().selectConversation(SECOND.id);
        deferred.resolve({
            generationId: retryMessageMock.mock.calls[0][0].generationId,
            conversation: createConversation(),
            assistantMessage: createMessage({
                id: 'assistant-retry',
                conversationId: 'conv-1',
                role: 'assistant',
            }),
        });

        expect(await retried).toBe(true);
        expect(store.getState().activeConversationId).toBe(SECOND.id);
    });
});

describe('errors belong to their conversation (U4)', () => {
    it('keeps a background stream error on its own conversation', async () => {
        const { store, listeners, event } = await startRun();
        await store.getState().selectConversation(SECOND.id);

        listeners.aiStreamError?.({
            ...event,
            error: 'Rate limit reached',
            code: 'rate-limit',
            retryable: true,
        });

        const state = store.getState();
        expect(state.error).toBeNull();
        expect(state.runNoticeByConversation[SECOND.id]).toBeUndefined();
        expect(state.runNoticeByConversation['conv-1']).toEqual({
            kind: 'error',
            messageId: 'assistant-1',
            code: 'rate-limit',
            retryable: true,
            detail: 'Rate limit reached',
        });
    });

    it('records a refused send on the conversation instead of a global error', async () => {
        const { store } = await createHarness({
            sendMessageImpl: async () => {
                throw new Error(
                    "Error invoking remote method 'ai:sendMessage': Error: Conversation introuvable.",
                );
            },
        });

        await store.getState().sendMessage('bonjour');
        await flushAsync();

        expect(store.getState().error).toBeNull();
        expect(store.getState().runNoticeByConversation['conv-1']).toEqual({
            kind: 'error',
            messageId: null,
            code: null,
            retryable: null,
            detail: 'Conversation introuvable.',
        });
    });

    it('clears the conversation notice when a new run starts', async () => {
        const { store, listeners, event } = await startRun();
        listeners.aiStreamError?.({ ...event, error: 'boom' });
        expect(store.getState().runNoticeByConversation['conv-1']).toBeDefined();

        await store.getState().sendMessage('encore');
        await flushAsync();

        expect(store.getState().runNoticeByConversation['conv-1']).toBeUndefined();
    });

    it('clears a list error when another conversation is opened', async () => {
        const { store } = await harnessWithSecondConversation();
        store.setState({ error: 'Le chargement des conversations a échoué.' });

        await store.getState().selectConversation(SECOND.id);

        expect(store.getState().error).toBeNull();
    });
});

describe('outcome notices (G6)', () => {
    it('marks a cut answer so it can be continued', async () => {
        const harness = await startRun();
        giveAnswerText(harness, 'Une partie');
        harness.listeners.aiStreamComplete?.({
            ...harness.event,
            outcome: { ...COMPLETE_OUTCOME, finishReason: 'length', truncated: true },
        });

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toEqual({
            kind: 'truncated',
            messageId: 'assistant-1',
        });
    });

    it('marks research stopped by the step limit', async () => {
        const harness = await startRun();
        giveAnswerText(harness, 'Réponse');
        harness.listeners.aiStreamComplete?.({
            ...harness.event,
            outcome: { ...COMPLETE_OUTCOME, stepLimitReached: true, stoppedBy: 'stop-condition' },
        });

        expect(harness.store.getState().runNoticeByConversation['conv-1']?.kind).toBe('step-limit');
    });

    it('adds nothing to a complete answer', async () => {
        const harness = await startRun();
        giveAnswerText(harness, 'Réponse complète');
        harness.listeners.aiStreamComplete?.({ ...harness.event, outcome: COMPLETE_OUTCOME });

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toBeUndefined();
        expect(harness.store.getState().error).toBeNull();
    });

    it('marks an answer without text instead of a global error', async () => {
        const harness = await startRun();
        harness.listeners.aiStreamComplete?.({ ...harness.event, outcome: COMPLETE_OUTCOME });

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toEqual({
            kind: 'empty',
            messageId: 'assistant-1',
        });
        expect(harness.store.getState().error).toBeNull();
    });

    it('marks an answer the user stopped', async () => {
        const harness = await startRun();
        giveAnswerText(harness, 'Début');
        await harness.store.getState().stopGeneration();
        harness.listeners.aiStreamCancel?.(harness.event);

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toEqual({
            kind: 'stopped',
            messageId: 'assistant-1',
        });
    });

    it('adds no stopped notice to a run cancelled by the app', async () => {
        const harness = await startRun();
        harness.listeners.aiStreamCancel?.(harness.event);

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toBeUndefined();
    });

    it('keeps the raw text when main sends no error code', async () => {
        const harness = await startRun();
        harness.listeners.aiStreamError?.({
            ...harness.event,
            error: 'Failed to process successful response',
        });

        expect(harness.store.getState().runNoticeByConversation['conv-1']).toEqual({
            kind: 'error',
            messageId: 'assistant-1',
            code: null,
            retryable: null,
            detail: 'Failed to process successful response',
        });
    });
});

describe('double send without a conversation (U5)', () => {
    it('creates one conversation for two quick sends', async () => {
        const created = createDeferred<ReturnType<typeof createConversation>>();
        const { store, createConversationMock, sendMessageMock } = await createHarness({
            createConversationImpl: () => created.promise,
            sendMessageImpl: async (request, index) => createSendResult(request, index),
        });
        store.setState({ activeConversationId: null, conversations: [] });

        const first = store.getState().sendMessage('première');
        const second = store.getState().sendMessage('seconde');
        created.resolve(createConversation({ id: 'conv-fresh' }));
        await Promise.all([first, second]);
        await flushAsync();

        expect(createConversationMock).toHaveBeenCalledTimes(1);
        expect(sendMessageMock).toHaveBeenCalledTimes(1);
        expect(sendMessageMock.mock.calls[0][0].conversationId).toBe('conv-fresh');
        expect(store.getState().queuedMessagesByConversation['conv-fresh']).toHaveLength(1);
    });

    it('lets a later send create a new conversation after a failed creation', async () => {
        let attempts = 0;
        const { store, createConversationMock } = await createHarness({
            createConversationImpl: async () => {
                attempts += 1;
                if (attempts === 1) throw new Error('DB locked');
                return createConversation({ id: 'conv-fresh' });
            },
        });
        store.setState({ activeConversationId: null, conversations: [] });

        expect(await store.getState().sendMessage('première')).toBe(false);
        expect(await store.getState().sendMessage('seconde')).toBe(true);
        expect(createConversationMock).toHaveBeenCalledTimes(2);
    });
});

describe('Stop right after sending (U6)', () => {
    it('sends the stop at once and again when the run is known', async () => {
        const deferred = createDeferred<AiSendMessageResult>();
        const { store, sendMessageMock, stopGenerationMock } = await createHarness({
            sendMessageImpl: () => deferred.promise,
        });

        await store.getState().sendMessage('bonjour');
        await flushAsync();
        await store.getState().stopGeneration();

        expect(stopGenerationMock).toHaveBeenCalledTimes(1);
        expect(stopGenerationMock).toHaveBeenCalledWith('conv-1');

        deferred.resolve(createSendResult(sendMessageMock.mock.calls[0][0], 1));
        await flushAsync();

        expect(store.getState().conversationRuns['conv-1']?.status).toBe('stopping');
        expect(stopGenerationMock).toHaveBeenCalledTimes(2);
    });

    it('sends the remembered stop to the id main gives the new conversation', async () => {
        const deferred = createDeferred<AiSendMessageResult>();
        const { store, sendMessageMock, stopGenerationMock } = await createHarness({
            sendMessageImpl: () => deferred.promise,
        });

        await store.getState().sendMessage('bonjour');
        await flushAsync();
        await store.getState().stopGeneration();
        deferred.resolve(
            createSendResult(
                sendMessageMock.mock.calls[0][0],
                1,
                createConversation({ id: 'conv-new' }),
            ),
        );
        await flushAsync();

        expect(stopGenerationMock).toHaveBeenLastCalledWith('conv-new');
        expect(store.getState().conversationRuns['conv-new']?.status).toBe('stopping');
    });

    it('does not resend a stop when the user did not press Stop', async () => {
        const { store, stopGenerationMock } = await createHarness();

        await store.getState().sendMessage('bonjour');
        await flushAsync();

        expect(stopGenerationMock).not.toHaveBeenCalled();
        expect(store.getState().conversationRuns['conv-1']?.status).toBe('streaming');
    });
});

describe('loaded history after a reply (U9)', () => {
    it('keeps every loaded message of the open conversation', async () => {
        const harness = await startRun();
        harness.store.setState((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                'conv-1': [...messagesOf(90, 'conv-1'), ...state.messagesByConversation['conv-1']],
            },
        }));
        giveAnswerText(harness, 'Réponse');
        harness.listeners.aiStreamComplete?.(harness.event);

        expect(harness.store.getState().messagesByConversation['conv-1']).toHaveLength(92);
    });

    it('frees the long history once the user leaves the finished conversation', async () => {
        const harness = await startRun();
        harness.store.setState((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                'conv-1': [...messagesOf(90, 'conv-1'), ...state.messagesByConversation['conv-1']],
            },
        }));
        giveAnswerText(harness, 'Réponse');
        harness.listeners.aiStreamComplete?.(harness.event);
        await harness.store.getState().selectConversation(SECOND.id);

        expect(harness.store.getState().messagesByConversation['conv-1']).toBeUndefined();
    });

    it('trims a conversation the user has left to the recent window', async () => {
        const harness = await startRun();
        harness.store.setState((state) => ({
            messagesByConversation: {
                ...state.messagesByConversation,
                'conv-1': [...messagesOf(90, 'conv-1'), ...state.messagesByConversation['conv-1']],
            },
        }));
        await harness.store.getState().selectConversation(SECOND.id);
        giveAnswerText(harness, 'Réponse');
        harness.listeners.aiStreamComplete?.(harness.event);

        const state = harness.store.getState();
        expect(state.messagesByConversation['conv-1']).toHaveLength(30);
        expect(state.historyByConversation['conv-1']?.hasMore).toBe(true);
    });
});

describe('store lifecycle (U10, U11, U12)', () => {
    it('loads the conversations once when initialize runs again', async () => {
        const { store, getConversationsPageMock } = await createHarness();

        await Promise.all([store.getState().initialize(), store.getState().initialize()]);

        expect(getConversationsPageMock).toHaveBeenCalledTimes(1);
    });

    it('leaves the counts alone for an updated conversation outside the loaded window', async () => {
        const { store, listeners } = await createHarness();
        store.setState({
            conversationList: { loadedCount: 1, totalCount: 40, hasMore: true },
            searchResults: [createConversation({ id: 'conv-old', title: 'Ancien' })],
        });

        listeners.aiConversationUpdated?.({
            conversation: createConversation({
                id: 'conv-old',
                title: 'Titre IA',
                updatedAt: '2025-01-01T00:00:00.000Z',
            }),
        });

        const state = store.getState();
        expect(state.conversationList).toEqual({ loadedCount: 1, totalCount: 40, hasMore: true });
        expect(state.conversations.map((c) => c.id)).toEqual(['conv-1']);
        expect(state.searchResults?.[0]?.title).toBe('Titre IA');
    });

    it('adds a new conversation that belongs at the top of the list', async () => {
        const { store, listeners } = await createHarness();
        store.setState({ conversationList: { loadedCount: 1, totalCount: 1, hasMore: false } });

        listeners.aiConversationUpdated?.({
            conversation: createConversation({
                id: 'conv-new',
                updatedAt: '2027-01-01T00:00:00.000Z',
            }),
        });

        expect(store.getState().conversations[0]?.id).toBe('conv-new');
    });

    it.each([
        ['deleteConversation', () => ['conv-1'] as const],
        ['clearConversations', () => [] as const],
        ['createConversation', () => ['Nouvelle'] as const],
    ] as const)('shows an error when %s fails', async (action, args) => {
        const harness = await createHarness();
        const api = (window as unknown as { api: { ai: Record<string, ReturnType<typeof vi.fn>> } })
            .api.ai;
        api[action].mockRejectedValue(new Error('SQLITE_BUSY'));

        const call = harness.store.getState()[action] as (...input: string[]) => Promise<void>;
        await expect(call(...args())).resolves.toBeUndefined();

        expect(harness.store.getState().error).toBe('SQLITE_BUSY');
    });
});

describe('message length (U20)', () => {
    it('refuses a too-long message before it reaches the queue', async () => {
        const { store, sendMessageMock } = await createHarness();

        const accepted = await store.getState().sendMessage('a'.repeat(AI_MESSAGE_MAX_LENGTH + 1));

        expect(accepted).toBe(false);
        expect(sendMessageMock).not.toHaveBeenCalled();
        expect(store.getState().queuedMessagesByConversation['conv-1']).toBeUndefined();
        expect(store.getState().error).toBe(
            'Le message est trop long. Raccourcissez-le puis réessayez.',
        );
    });

    it('accepts a message at the limit', async () => {
        const { store, sendMessageMock } = await createHarness();

        expect(await store.getState().sendMessage('é'.repeat(AI_MESSAGE_MAX_LENGTH))).toBe(true);
        await flushAsync();

        expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    it('keeps a refused batch queued so it can be sent again', async () => {
        let fail = true;
        const { store, sendMessageMock } = await createHarness({
            sendMessageImpl: async (request, index) => {
                if (fail) throw new Error('offline');
                return createSendResult(request, index);
            },
        });

        await store.getState().sendMessage('bonjour');
        await flushAsync();
        expect(store.getState().queuedMessagesByConversation['conv-1']).toHaveLength(1);

        fail = false;
        await store.getState().flushQueuedMessages('conv-1');

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(store.getState().queuedMessagesByConversation['conv-1']).toBeUndefined();
    });
});

describe('conversation list refresh keeps the open conversation', () => {
    it('keeps a conversation opened from search selected after initialize', async () => {
        const { store, getConversationsPageMock } = await createHarness();
        const old = createConversation({ id: 'conv-old', updatedAt: '2025-01-01T00:00:00.000Z' });
        store.setState({ activeConversationId: old.id, activeConversationRecord: old });
        getConversationsPageMock.mockResolvedValue(createConversationHistoryPage([]));

        await store.getState().loadConversations();

        expect(store.getState().activeConversationId).toBe(old.id);
    });
});
