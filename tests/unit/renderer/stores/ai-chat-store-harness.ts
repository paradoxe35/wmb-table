import { vi } from 'vitest';
import type {
    AiConversation,
    AiConversationHistoryPage,
    AiMessage,
    AiMessageHistoryPage,
    AiMessageHistoryPageRequest,
    AiRetryMessageRequest,
    AiRetryMessageResult,
    AiSendMessageRequest,
    AiSendMessageResult,
    AiSettings,
} from '@shared/ai.types';
import { createDefaultAiSettings } from '@shared/ai.types';
import type { PushEventMap } from '@shared/ipc.types';
import { PushChannels } from '@shared/ipc.types';

type Listener<K extends keyof PushEventMap> = (payload: PushEventMap[K]) => void;

export interface ListenerMap {
    aiStreamChunk?: Listener<typeof PushChannels.aiStreamChunk>;
    aiReasoningDelta?: Listener<typeof PushChannels.aiReasoningDelta>;
    aiToolCallStart?: Listener<typeof PushChannels.aiToolCallStart>;
    aiToolCallComplete?: Listener<typeof PushChannels.aiToolCallComplete>;
    aiStreamComplete?: Listener<typeof PushChannels.aiStreamComplete>;
    aiStreamCancel?: Listener<typeof PushChannels.aiStreamCancel>;
    aiStreamError?: Listener<typeof PushChannels.aiStreamError>;
    aiConversationUpdated?: Listener<typeof PushChannels.aiConversationUpdated>;
}

export function createSettings(): AiSettings {
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

export function createConversation(partial?: Partial<AiConversation>): AiConversation {
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

export function createMessage(
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

export function createSendResult(
    request: AiSendMessageRequest,
    index: number,
    conversation = createConversation({ id: request.conversationId }),
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

export function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

export function createHistoryPage(
    messages: AiMessage[],
    partial?: Partial<Pick<AiMessageHistoryPage, 'loadedCount' | 'totalCount' | 'hasMore'>>,
): AiMessageHistoryPage {
    return {
        messages,
        loadedCount: partial?.loadedCount ?? messages.length,
        totalCount: partial?.totalCount ?? messages.length,
        hasMore: partial?.hasMore ?? false,
    };
}

export function createConversationHistoryPage(
    conversations: AiConversation[],
    partial?: Partial<Pick<AiConversationHistoryPage, 'loadedCount' | 'totalCount' | 'hasMore'>>,
): AiConversationHistoryPage {
    return {
        conversations,
        loadedCount: partial?.loadedCount ?? conversations.length,
        totalCount: partial?.totalCount ?? conversations.length,
        hasMore: partial?.hasMore ?? false,
    };
}

export async function flushAsync(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

export interface HarnessOptions {
    sendMessageImpl?: (
        request: AiSendMessageRequest,
        index: number,
    ) => Promise<AiSendMessageResult>;
    getMessagesPageImpl?: (request: AiMessageHistoryPageRequest) => Promise<AiMessageHistoryPage>;
    createConversationImpl?: () => Promise<AiConversation>;
    retryMessageImpl?: (request: AiRetryMessageRequest) => Promise<AiRetryMessageResult>;
}

export async function createHarness(options?: HarnessOptions) {
    vi.resetModules();

    const listeners: ListenerMap = {};
    const conversation = createConversation();
    let sendCount = 0;

    const sendMessageMock = vi.fn(async (request: AiSendMessageRequest) => {
        sendCount += 1;
        if (options?.sendMessageImpl) {
            return options.sendMessageImpl(request, sendCount);
        }
        return createSendResult(request, sendCount, conversation);
    });

    const getMessagesPageMock = vi.fn(
        async (request: AiMessageHistoryPageRequest) =>
            options?.getMessagesPageImpl?.(request) ?? createHistoryPage([], { totalCount: 0 }),
    );
    const getConversationsPageMock = vi.fn(async () =>
        createConversationHistoryPage([conversation]),
    );
    const createConversationMock = vi.fn(
        options?.createConversationImpl ?? (async () => conversation),
    );
    const retryMessageMock = vi.fn(
        options?.retryMessageImpl ??
            (async (request: AiRetryMessageRequest) => ({
                generationId: request.generationId,
                conversation: createConversation({ id: request.conversationId }),
                assistantMessage: createMessage({
                    id: 'assistant-retry',
                    conversationId: request.conversationId,
                    role: 'assistant',
                }),
            })),
    );
    const stopGenerationMock = vi.fn(async (_conversationId: string) => undefined);

    const subscribe =
        <K extends keyof ListenerMap>(key: K) =>
        (callback: NonNullable<ListenerMap[K]>) => {
            listeners[key] = callback;
            return () => {};
        };

    vi.stubGlobal('window', {
        api: {
            ai: {
                getSettings: vi.fn().mockResolvedValue(createSettings()),
                getProviderCatalog: vi.fn().mockResolvedValue([]),
                updateSettings: vi.fn(),
                getConversationsPage: getConversationsPageMock,
                createConversation: createConversationMock,
                renameConversation: vi.fn(),
                deleteConversation: vi.fn().mockResolvedValue(undefined),
                clearConversations: vi.fn().mockResolvedValue(undefined),
                getMessagesPage: getMessagesPageMock,
                sendMessage: sendMessageMock,
                retryMessage: retryMessageMock,
                stopGeneration: stopGenerationMock,
                testProvider: vi.fn(),
            },
            on: {
                aiStreamChunk: vi.fn(subscribe('aiStreamChunk')),
                aiReasoningDelta: vi.fn(subscribe('aiReasoningDelta')),
                aiToolCallStart: vi.fn(subscribe('aiToolCallStart')),
                aiToolCallComplete: vi.fn(subscribe('aiToolCallComplete')),
                aiStreamComplete: vi.fn(subscribe('aiStreamComplete')),
                aiStreamCancel: vi.fn(subscribe('aiStreamCancel')),
                aiStreamError: vi.fn(subscribe('aiStreamError')),
                aiConversationUpdated: vi.fn(subscribe('aiConversationUpdated')),
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

    return {
        store,
        listeners,
        getMessagesPageMock,
        getConversationsPageMock,
        sendMessageMock,
        createConversationMock,
        retryMessageMock,
        stopGenerationMock,
    };
}

export type StoreHarness = Awaited<ReturnType<typeof createHarness>>;
