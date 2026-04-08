import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    AiConversation,
    AiMessage,
    AiSendMessageRequest,
    AiSendMessageResult,
    AiSettings,
} from '@shared/ai.types';
import { createDefaultAiSettings } from '@shared/ai.types';
import type { PushEventMap } from '@shared/ipc.types';
import { PushChannels } from '@shared/ipc.types';

const markFeatureReminderUsedMock = vi.fn();

vi.mock('@renderer/lib/feature-reminders', () => ({
    markFeatureReminderUsed: markFeatureReminderUsedMock,
}));

type Listener<K extends keyof PushEventMap> = (payload: PushEventMap[K]) => void;

interface ListenerMap {
    aiStreamChunk?: Listener<typeof PushChannels.aiStreamChunk>;
    aiReasoningDelta?: Listener<typeof PushChannels.aiReasoningDelta>;
    aiToolCallStart?: Listener<typeof PushChannels.aiToolCallStart>;
    aiToolCallComplete?: Listener<typeof PushChannels.aiToolCallComplete>;
    aiStreamComplete?: Listener<typeof PushChannels.aiStreamComplete>;
    aiStreamCancel?: Listener<typeof PushChannels.aiStreamCancel>;
    aiStreamError?: Listener<typeof PushChannels.aiStreamError>;
    aiConversationUpdated?: Listener<typeof PushChannels.aiConversationUpdated>;
}

interface StoreHarness {
    store: typeof import('@renderer/stores/ai-chat.store').useAiChatStore;
    listeners: ListenerMap;
    sendMessageMock: ReturnType<typeof vi.fn<[AiSendMessageRequest], Promise<AiSendMessageResult>>>;
}

function createSettings(): AiSettings {
    const settings = createDefaultAiSettings();
    settings.enabled = true;
    settings.activeProvider = 'openai';
    settings.providers.openai = {
        enabled: true,
        model: 'gpt-5-mini',
        apiKey: 'test-key',
    };
    return settings;
}

function createConversation(partial?: Partial<AiConversation>): AiConversation {
    return {
        id: 'conv-1',
        title: 'Conversation',
        summary: null,
        aiTitle: false,
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-04-08T10:00:00.000Z',
        ...partial,
    };
}

function createMessage(
    partial: Partial<AiMessage> & Pick<AiMessage, 'id' | 'conversationId' | 'role'>,
): AiMessage {
    return {
        id: partial.id,
        conversationId: partial.conversationId,
        role: partial.role,
        content: partial.content ?? '',
        toolCalls: partial.toolCalls ?? [],
        toolResults: partial.toolResults ?? [],
        createdAt: partial.createdAt ?? '2026-04-08T10:00:00.000Z',
    };
}

function createSendResult(
    request: AiSendMessageRequest,
    index: number,
    conversation = createConversation(),
): AiSendMessageResult {
    return {
        generationId: request.generationId,
        conversation,
        userMessages: request.messages.map((content, messageIndex) =>
            createMessage({
                id: `user-${index}-${messageIndex + 1}`,
                conversationId: conversation.id,
                role: 'user',
                content,
            }),
        ),
        assistantMessage: createMessage({
            id: `assistant-${index}`,
            conversationId: conversation.id,
            role: 'assistant',
            content: '',
        }),
    };
}

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

async function flushAsync(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createHarness(options?: {
    sendMessageImpl?: (
        request: AiSendMessageRequest,
        index: number,
    ) => Promise<AiSendMessageResult>;
    getMessagesImpl?: (conversationId: string) => Promise<AiMessage[]>;
}): Promise<StoreHarness> {
    vi.resetModules();
    markFeatureReminderUsedMock.mockReset();

    const listeners: ListenerMap = {};
    const conversation = createConversation();
    let sendCount = 0;

    const sendMessageMock = vi.fn<[AiSendMessageRequest], Promise<AiSendMessageResult>>(
        async (request) => {
            sendCount += 1;
            if (options?.sendMessageImpl) {
                return options.sendMessageImpl(request, sendCount);
            }
            return createSendResult(request, sendCount, conversation);
        },
    );

    vi.stubGlobal('window', {
        api: {
            ai: {
                getSettings: vi.fn().mockResolvedValue(createSettings()),
                getProviderCatalog: vi.fn().mockResolvedValue([]),
                updateSettings: vi.fn(),
                getConversations: vi.fn().mockResolvedValue([]),
                createConversation: vi.fn().mockResolvedValue(conversation),
                deleteConversation: vi.fn().mockResolvedValue(undefined),
                clearConversations: vi.fn().mockResolvedValue(undefined),
                getMessages: vi
                    .fn()
                    .mockImplementation(
                        (conversationId: string) =>
                            options?.getMessagesImpl?.(conversationId) ?? Promise.resolve([]),
                    ),
                sendMessage: sendMessageMock,
                stopGeneration: vi.fn().mockResolvedValue(undefined),
                scanLocalModels: vi
                    .fn()
                    .mockResolvedValue({ models: [], supportedModels: [], scannedPath: '' }),
                testProvider: vi.fn(),
                downloadModel: vi.fn(),
            },
            on: {
                aiStreamChunk: vi.fn((cb) => {
                    listeners.aiStreamChunk = cb;
                    return () => {};
                }),
                aiReasoningDelta: vi.fn((cb) => {
                    listeners.aiReasoningDelta = cb;
                    return () => {};
                }),
                aiToolCallStart: vi.fn((cb) => {
                    listeners.aiToolCallStart = cb;
                    return () => {};
                }),
                aiToolCallComplete: vi.fn((cb) => {
                    listeners.aiToolCallComplete = cb;
                    return () => {};
                }),
                aiStreamComplete: vi.fn((cb) => {
                    listeners.aiStreamComplete = cb;
                    return () => {};
                }),
                aiStreamCancel: vi.fn((cb) => {
                    listeners.aiStreamCancel = cb;
                    return () => {};
                }),
                aiStreamError: vi.fn((cb) => {
                    listeners.aiStreamError = cb;
                    return () => {};
                }),
                aiConversationUpdated: vi.fn((cb) => {
                    listeners.aiConversationUpdated = cb;
                    return () => {};
                }),
            },
        },
        dispatchEvent: vi.fn(),
        requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        }),
        cancelAnimationFrame: vi.fn(),
    });

    const module = await import('@renderer/stores/ai-chat.store');
    const store = module.useAiChatStore;

    await store.getState().initialize();
    store.setState({
        conversations: [conversation],
        activeConversationId: conversation.id,
        messagesByConversation: { [conversation.id]: [] },
        error: null,
    });

    return { store, listeners, sendMessageMock };
}

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

    it('keeps the local assistant placeholder when conversation history finishes loading after send', async () => {
        const deferredMessages = createDeferred<AiMessage[]>();
        const conversation = createConversation({ id: 'conv-2', title: 'Second' });
        const { store, sendMessageMock } = await createHarness({
            getMessagesImpl: async (conversationId) =>
                conversationId === 'conv-2' ? deferredMessages.promise : [],
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

        deferredMessages.resolve([]);
        await selectPromise;
        await flushAsync();

        const messages = store.getState().messagesByConversation['conv-2'];
        expect(messages.map((message) => message.id)).toEqual(['user-1-1', 'assistant-1']);
    });
});
