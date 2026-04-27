import type {
    AiConversation,
    AiConversationHistoryPage,
    AiMessageHistoryPage,
    AiMessage,
    AiModelScanResult,
    AiProviderDefinition,
    AiRetryMessageResult,
    AiProviderTestResult,
    AiSendMessageResult,
    AiSettings,
} from '@shared/ai.types';
import type { PdfExportResult } from '@shared/ipc.types';
import {
    AI_CONVERSATION_HISTORY_PAGE_SIZE,
    AI_MESSAGE_HISTORY_PAGE_SIZE,
    resolveActiveModel,
    resolveProviderName,
} from '@shared/ai.types';
import { AI_DATA_EVENT, APP_UI_EVENT } from '@renderer/utils/events';
import { createStore } from './create-store';
import { markFeatureReminderUsed } from '@renderer/lib/feature-reminders';

const TOOL_TO_EVENT: Record<string, string> = {
    createNote: AI_DATA_EVENT.notesChanged,
    updateNoteContent: AI_DATA_EVENT.notesChanged,
    addSermonReferenceToNote: AI_DATA_EVENT.notesChanged,
    createSubject: AI_DATA_EVENT.subjectsChanged,
    addSermonReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
    addBibleReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
    removeSubjectReference: AI_DATA_EVENT.subjectsChanged,
};

type MessageMap = Record<string, AiMessage[]>;
type ReasoningMap = Record<string, string>;
type LoadingConversationMap = Record<string, true>;
type ConversationHistoryMap = Record<string, ConversationHistoryState>;

type ConversationRunStatus = 'starting' | 'streaming' | 'stopping';

interface ConversationRunState {
    generationId: string;
    assistantMessageId: string | null;
    status: ConversationRunStatus;
}

interface ConversationHistoryState {
    loadedCount: number;
    hasMore: boolean;
}

interface ConversationListState {
    loadedCount: number;
    totalCount: number;
    hasMore: boolean;
}

interface QueuedMessage {
    id: string;
    content: string;
    createdAt: string;
}

type ConversationRunMap = Record<string, ConversationRunState>;
type QueuedMessageMap = Record<string, QueuedMessage[]>;

function createConversationHistoryState(page: AiMessageHistoryPage): ConversationHistoryState {
    return {
        loadedCount: page.loadedCount,
        hasMore: page.hasMore,
    };
}

function createConversationListState(page: AiConversationHistoryPage): ConversationListState {
    return {
        loadedCount: page.loadedCount,
        totalCount: page.totalCount,
        hasMore: page.hasMore,
    };
}

function sortConversationsByUpdatedAt(conversations: AiConversation[]): AiConversation[] {
    return [...conversations].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

function upsertMessage(messages: AiMessage[], message: AiMessage): AiMessage[] {
    const existing = messages.findIndex((item) => item.id === message.id);
    if (existing === -1) {
        return [...messages, message];
    }

    return messages.map((item, index) => (index === existing ? message : item));
}

function upsertConversation(
    conversations: AiConversation[],
    conversation: AiConversation,
): AiConversation[] {
    const existing = conversations.findIndex((item) => item.id === conversation.id);
    if (existing === -1) {
        return sortConversationsByUpdatedAt([conversation, ...conversations]);
    }

    return sortConversationsByUpdatedAt(
        conversations.map((item, index) => (index === existing ? conversation : item)),
    );
}

function mergeFetchedConversations(
    existing: AiConversation[],
    fetched: AiConversation[],
): AiConversation[] {
    const mergedById = new Map<string, AiConversation>();

    for (const conversation of existing) {
        mergedById.set(conversation.id, conversation);
    }

    for (const conversation of fetched) {
        mergedById.set(conversation.id, conversation);
    }

    return sortConversationsByUpdatedAt([...mergedById.values()]);
}

function updateConversationMessages(
    messagesByConversation: MessageMap,
    conversationId: string,
    updater: (messages: AiMessage[]) => AiMessage[],
): MessageMap {
    const current = messagesByConversation[conversationId] ?? [];
    return {
        ...messagesByConversation,
        [conversationId]: updater(current),
    };
}

function mergeMessageVersions(local: AiMessage, remote: AiMessage): AiMessage {
    return {
        ...remote,
        content: local.content.length >= remote.content.length ? local.content : remote.content,
        toolCalls:
            local.toolCalls.length >= remote.toolCalls.length ? local.toolCalls : remote.toolCalls,
        toolResults:
            local.toolResults.length >= remote.toolResults.length
                ? local.toolResults
                : remote.toolResults,
    };
}

function mergeFetchedMessages(existing: AiMessage[], fetched: AiMessage[]): AiMessage[] {
    if (existing.length === 0) {
        return fetched;
    }

    const mergedById = new Map<string, AiMessage>();

    for (const message of fetched) {
        mergedById.set(message.id, message);
    }

    for (const message of existing) {
        const fetchedMessage = mergedById.get(message.id);
        mergedById.set(
            message.id,
            fetchedMessage ? mergeMessageVersions(message, fetchedMessage) : message,
        );
    }

    return [...mergedById.values()].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
}

function keepRecentMessages(
    messages: AiMessage[],
    maxMessages = AI_MESSAGE_HISTORY_PAGE_SIZE,
): {
    messages: AiMessage[];
    removedMessageIds: string[];
    wasTrimmed: boolean;
} {
    if (messages.length <= maxMessages) {
        return {
            messages,
            removedMessageIds: [],
            wasTrimmed: false,
        };
    }

    const removed = messages.slice(0, messages.length - maxMessages);
    return {
        messages: messages.slice(-maxMessages),
        removedMessageIds: removed.map((message) => message.id),
        wasTrimmed: true,
    };
}

function updateRecentHistoryWindow(
    history: ConversationHistoryState | undefined,
    messageCount: number,
    wasTrimmed: boolean,
): ConversationHistoryState {
    return {
        loadedCount: messageCount,
        hasMore: Boolean(history?.hasMore || wasTrimmed),
    };
}

function minimizeMessageForRenderer(message: AiMessage): AiMessage {
    return {
        ...message,
        toolCalls: message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.name,
            input: {},
        })),
        toolResults: message.toolResults.map((toolResult) => ({
            toolCallId: toolResult.toolCallId,
            name: toolResult.name,
            output: null,
            ...(toolResult.isError !== undefined ? { isError: toolResult.isError } : {}),
        })),
    };
}

function minimizeMessagesForRenderer(messages: AiMessage[]): AiMessage[] {
    return messages.map(minimizeMessageForRenderer);
}

function removeConversationKey<T>(
    map: Record<string, T>,
    conversationId: string,
): Record<string, T> {
    if (!(conversationId in map)) {
        return map;
    }

    const next = { ...map };
    delete next[conversationId];
    return next;
}

function removeReasoning(reasoningByMessage: ReasoningMap, messageId: string): ReasoningMap {
    if (!(messageId in reasoningByMessage)) {
        return reasoningByMessage;
    }

    const next = { ...reasoningByMessage };
    delete next[messageId];
    return next;
}

function removeReasoningByMessageIds(
    reasoningByMessage: ReasoningMap,
    messageIds: Iterable<string>,
): ReasoningMap {
    let next = reasoningByMessage;
    for (const messageId of messageIds) {
        next = removeReasoning(next, messageId);
    }
    return next;
}

function countRuns(conversationRuns: ConversationRunMap): number {
    return Object.keys(conversationRuns).length;
}

function isMessageEmpty(message: AiMessage | undefined): boolean {
    if (!message) {
        return true;
    }

    return (
        !message.content.trim() &&
        message.toolCalls.length === 0 &&
        message.toolResults.length === 0
    );
}

function createQueuedMessage(content: string): QueuedMessage {
    return {
        id: crypto.randomUUID(),
        content,
        createdAt: new Date().toISOString(),
    };
}

function stripIpcPrefix(message: string): string {
    const match = message.match(/^Error invoking remote method '[^']+': (?:Error: )?(.+)$/s);
    return match ? match[1] : message;
}

function toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
        return stripIpcPrefix(error.message);
    }

    if (typeof error === 'string' && error.trim()) {
        return stripIpcPrefix(error);
    }

    return fallback;
}

function moveConversationRun(
    conversationRuns: ConversationRunMap,
    fromConversationId: string,
    toConversationId: string,
    updater: (run: ConversationRunState) => ConversationRunState,
): ConversationRunMap {
    const currentRun = conversationRuns[fromConversationId];
    if (!currentRun) {
        return conversationRuns;
    }

    const nextRuns =
        fromConversationId === toConversationId
            ? { ...conversationRuns }
            : removeConversationKey(conversationRuns, fromConversationId);

    nextRuns[toConversationId] = updater(currentRun);
    return nextRuns;
}

function pruneConversationCache(
    state: Pick<
        AiChatState,
        | 'messagesByConversation'
        | 'reasoningByMessage'
        | 'loadingConversations'
        | 'loadingOlderConversations'
        | 'historyByConversation'
        | 'conversationRuns'
        | 'queuedMessagesByConversation'
    >,
    activeConversationId: string | null,
): Pick<
    AiChatState,
    | 'messagesByConversation'
    | 'reasoningByMessage'
    | 'loadingConversations'
    | 'loadingOlderConversations'
    | 'historyByConversation'
> {
    const keepConversationIds = new Set<string>();

    if (activeConversationId) {
        keepConversationIds.add(activeConversationId);
    }

    for (const conversationId of Object.keys(state.conversationRuns)) {
        keepConversationIds.add(conversationId);
    }

    for (const conversationId of Object.keys(state.queuedMessagesByConversation)) {
        keepConversationIds.add(conversationId);
    }

    const removableConversationIds = Object.keys(state.messagesByConversation).filter(
        (conversationId) => !keepConversationIds.has(conversationId),
    );

    if (removableConversationIds.length === 0) {
        return {
            messagesByConversation: state.messagesByConversation,
            reasoningByMessage: state.reasoningByMessage,
            loadingConversations: state.loadingConversations,
            loadingOlderConversations: state.loadingOlderConversations,
            historyByConversation: state.historyByConversation,
        };
    }

    const nextMessages = Object.fromEntries(
        Object.entries(state.messagesByConversation).filter(([conversationId]) =>
            keepConversationIds.has(conversationId),
        ),
    );
    const nextLoading = Object.fromEntries(
        Object.entries(state.loadingConversations).filter(([conversationId]) =>
            keepConversationIds.has(conversationId),
        ),
    );
    const nextLoadingOlder = Object.fromEntries(
        Object.entries(state.loadingOlderConversations).filter(([conversationId]) =>
            keepConversationIds.has(conversationId),
        ),
    );
    const nextHistory = Object.fromEntries(
        Object.entries(state.historyByConversation).filter(([conversationId]) =>
            keepConversationIds.has(conversationId),
        ),
    );
    const removedMessageIds = removableConversationIds.flatMap((conversationId) =>
        (state.messagesByConversation[conversationId] ?? []).map((m) => m.id),
    );

    return {
        messagesByConversation: nextMessages,
        reasoningByMessage: removeReasoningByMessageIds(
            state.reasoningByMessage,
            removedMessageIds,
        ),
        loadingConversations: nextLoading,
        loadingOlderConversations: nextLoadingOlder,
        historyByConversation: nextHistory,
    };
}

function getLastConversationMessage(
    messagesByConversation: MessageMap,
    conversationId: string,
): AiMessage | null {
    const messages = messagesByConversation[conversationId] ?? [];
    return messages[messages.length - 1] ?? null;
}

function resolvePersistedActiveConversationId(
    conversations: AiConversation[],
    activeConversationId: string | null,
): string | null {
    if (!activeConversationId) {
        return null;
    }

    return conversations.some((conversation) => conversation.id === activeConversationId)
        ? activeConversationId
        : null;
}

let listenersBound = false;

interface AiChatState {
    initialized: boolean;
    settings: AiSettings | null;
    providerCatalog: AiProviderDefinition[];
    conversations: AiConversation[];
    conversationList: ConversationListState;
    activeConversationId: string | null;
    messagesByConversation: MessageMap;
    reasoningByMessage: ReasoningMap;
    loadingConversationList: boolean;
    loadingOlderConversationList: boolean;
    loadingConversations: LoadingConversationMap;
    loadingOlderConversations: LoadingConversationMap;
    historyByConversation: ConversationHistoryMap;
    conversationRuns: ConversationRunMap;
    queuedMessagesByConversation: QueuedMessageMap;
    localModels: AiModelScanResult | null;
    sending: boolean;
    error: string | null;
    completionCount: number;
    lastCompletedConversationId: string | null;

    initialize(): Promise<void>;
    loadSettings(): Promise<void>;
    loadProviderCatalog(): Promise<void>;
    saveSettings(partial: Partial<AiSettings>): Promise<void>;
    loadConversations(): Promise<void>;
    loadOlderConversations(): Promise<void>;
    selectConversation(conversationId: string): Promise<void>;
    loadOlderMessages(conversationId: string): Promise<void>;
    createConversation(title?: string): Promise<void>;
    renameConversation(conversationId: string, title: string): Promise<AiConversation>;
    deleteConversation(conversationId: string): Promise<void>;
    exportConversationPdf(conversationId: string): Promise<PdfExportResult>;
    clearConversations(): Promise<void>;
    sendMessage(content: string): Promise<boolean>;
    sendMessageNow(conversationId: string, messages: string[]): Promise<boolean>;
    flushQueuedMessages(
        conversationId: string,
        options?: { requeueOnFailure?: boolean },
    ): Promise<boolean>;
    retryLastUserMessage(conversationId: string, messageId: string): Promise<boolean>;
    removeQueuedMessage(conversationId: string, queuedMessageId: string): void;
    stopGeneration(): Promise<void>;
    scanLocalModels(): Promise<void>;
    testProvider(input: {
        providerId: string;
        model: string;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<AiProviderTestResult>;
    downloadModel(modelId: string): Promise<void>;
}

export const useAiChatStore = createStore<AiChatState>((set, get) => ({
    initialized: false,
    settings: null,
    providerCatalog: [],
    conversations: [],
    conversationList: {
        loadedCount: 0,
        totalCount: 0,
        hasMore: false,
    },
    activeConversationId: null,
    messagesByConversation: {},
    reasoningByMessage: {},
    loadingConversationList: false,
    loadingOlderConversationList: false,
    loadingConversations: {},
    loadingOlderConversations: {},
    historyByConversation: {},
    conversationRuns: {},
    queuedMessagesByConversation: {},
    localModels: null,
    sending: false,
    error: null,
    completionCount: 0,
    lastCompletedConversationId: null,

    initialize: async () => {
        if (!listenersBound) {
            listenersBound = true;

            window.api.on.aiStreamChunk(({ conversationId, generationId, messageId, delta }) => {
                set((state) => {
                    const run = state.conversationRuns[conversationId];
                    if (!run || run.generationId !== generationId) {
                        return state;
                    }

                    return {
                        messagesByConversation: updateConversationMessages(
                            state.messagesByConversation,
                            conversationId,
                            (messages) =>
                                messages.map((message) =>
                                    message.id === messageId
                                        ? { ...message, content: `${message.content}${delta}` }
                                        : message,
                                ),
                        ),
                    };
                });
            });

            window.api.on.aiReasoningDelta(({ conversationId, generationId, messageId, delta }) => {
                set((state) => {
                    const run = state.conversationRuns[conversationId];
                    if (!run || run.generationId !== generationId) {
                        return state;
                    }

                    return {
                        reasoningByMessage: {
                            ...state.reasoningByMessage,
                            [messageId]: (state.reasoningByMessage[messageId] ?? '') + delta,
                        },
                    };
                });
            });

            window.api.on.aiToolCallStart(
                ({ conversationId, generationId, messageId, toolName, toolCallId, payload }) => {
                    set((state) => {
                        const run = state.conversationRuns[conversationId];
                        if (!run || run.generationId !== generationId) {
                            return state;
                        }

                        return {
                            messagesByConversation: updateConversationMessages(
                                state.messagesByConversation,
                                conversationId,
                                (messages) =>
                                    messages.map((message) =>
                                        message.id === messageId
                                            ? {
                                                  ...message,
                                                  toolCalls: [
                                                      ...message.toolCalls,
                                                      {
                                                          id: toolCallId,
                                                          name: toolName,
                                                          input:
                                                              (payload as Record<
                                                                  string,
                                                                  unknown
                                                              >) ?? {},
                                                      },
                                                  ],
                                              }
                                            : message,
                                    ),
                            ),
                        };
                    });
                },
            );

            window.api.on.aiToolCallComplete(
                ({ conversationId, generationId, messageId, toolName, toolCallId, payload }) => {
                    set((state) => {
                        const run = state.conversationRuns[conversationId];
                        if (!run || run.generationId !== generationId) {
                            return state;
                        }

                        return {
                            messagesByConversation: updateConversationMessages(
                                state.messagesByConversation,
                                conversationId,
                                (messages) =>
                                    messages.map((message) =>
                                        message.id === messageId
                                            ? {
                                                  ...message,
                                                  toolResults: [
                                                      ...message.toolResults,
                                                      {
                                                          toolCallId,
                                                          name: toolName,
                                                          output: payload,
                                                      },
                                                  ],
                                              }
                                            : message,
                                    ),
                            ),
                        };
                    });

                    const event = TOOL_TO_EVENT[toolName];
                    if (event) {
                        window.dispatchEvent(new Event(event));
                    }
                },
            );

            window.api.on.aiStreamComplete(({ conversationId, generationId }) => {
                let shouldFlushQueue = false;

                set((state) => {
                    const run = state.conversationRuns[conversationId];
                    if (!run || run.generationId !== generationId) {
                        return state;
                    }

                    const conversationRuns = removeConversationKey(
                        state.conversationRuns,
                        conversationId,
                    );
                    const assistantMessage = run.assistantMessageId
                        ? (state.messagesByConversation[conversationId] ?? []).find(
                              (message) => message.id === run.assistantMessageId,
                          )
                        : undefined;
                    const completedWithEmptyAssistant = Boolean(
                        run.assistantMessageId && isMessageEmpty(assistantMessage),
                    );
                    const queuedMessageCount = (
                        state.queuedMessagesByConversation[conversationId] ?? []
                    ).length;
                    shouldFlushQueue = queuedMessageCount > 0;
                    const shouldSurfaceEmptyCompletion =
                        completedWithEmptyAssistant && queuedMessageCount === 0;

                    return {
                        conversationRuns,
                        sending: countRuns(conversationRuns) > 0,
                        messagesByConversation:
                            completedWithEmptyAssistant && run.assistantMessageId
                                ? updateConversationMessages(
                                      state.messagesByConversation,
                                      conversationId,
                                      (messages) =>
                                          messages.filter(
                                              (message) => message.id !== run.assistantMessageId,
                                          ),
                                  )
                                : state.messagesByConversation,
                        reasoningByMessage:
                            completedWithEmptyAssistant && run.assistantMessageId
                                ? removeReasoning(state.reasoningByMessage, run.assistantMessageId)
                                : state.reasoningByMessage,
                        error: shouldSurfaceEmptyCompletion ? 'Réponse sans texte' : state.error,
                        completionCount: state.completionCount + 1,
                        lastCompletedConversationId: conversationId,
                    };
                });

                if (shouldFlushQueue) {
                    void get().flushQueuedMessages(conversationId);
                }
            });

            window.api.on.aiStreamCancel(({ conversationId, generationId, messageId }) => {
                let shouldFlushQueue = false;

                set((state) => {
                    const run = state.conversationRuns[conversationId];
                    if (!run || run.generationId !== generationId) {
                        return state;
                    }

                    const conversationRuns = removeConversationKey(
                        state.conversationRuns,
                        conversationId,
                    );
                    const currentMessages = state.messagesByConversation[conversationId] ?? [];
                    const nextMessages = currentMessages.filter((message) => {
                        if (message.id !== messageId) {
                            return true;
                        }

                        return !isMessageEmpty(message);
                    });

                    shouldFlushQueue =
                        (state.queuedMessagesByConversation[conversationId] ?? []).length > 0;

                    return {
                        conversationRuns,
                        sending: countRuns(conversationRuns) > 0,
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [conversationId]: nextMessages,
                        },
                        reasoningByMessage: removeReasoning(state.reasoningByMessage, messageId),
                        completionCount: state.completionCount + 1,
                        lastCompletedConversationId: conversationId,
                    };
                });

                if (shouldFlushQueue) {
                    void get().flushQueuedMessages(conversationId);
                }
            });

            window.api.on.aiStreamError(({ conversationId, generationId, messageId, error }) => {
                let shouldFlushQueue = false;

                set((state) => {
                    const run = state.conversationRuns[conversationId];
                    if (!run || run.generationId !== generationId) {
                        return state;
                    }

                    const conversationRuns = removeConversationKey(
                        state.conversationRuns,
                        conversationId,
                    );
                    shouldFlushQueue =
                        (state.queuedMessagesByConversation[conversationId] ?? []).length > 0;
                    const currentMessages = state.messagesByConversation[conversationId] ?? [];
                    const nextMessages = currentMessages.filter((message) => {
                        if (message.id !== messageId) {
                            return true;
                        }

                        return !isMessageEmpty(message);
                    });

                    return {
                        conversationRuns,
                        sending: countRuns(conversationRuns) > 0,
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [conversationId]: nextMessages,
                        },
                        reasoningByMessage: removeReasoning(state.reasoningByMessage, messageId),
                        error,
                        completionCount: state.completionCount + 1,
                        lastCompletedConversationId: conversationId,
                    };
                });

                if (shouldFlushQueue) {
                    void get().flushQueuedMessages(conversationId);
                }
            });

            window.api.on.aiConversationUpdated(({ conversation }) => {
                set((state) => {
                    const alreadyPresent = state.conversations.some(
                        (item) => item.id === conversation.id,
                    );

                    return {
                        conversations: upsertConversation(state.conversations, conversation),
                        conversationList: {
                            ...state.conversationList,
                            loadedCount: alreadyPresent
                                ? state.conversationList.loadedCount
                                : state.conversationList.loadedCount + 1,
                            totalCount: alreadyPresent
                                ? state.conversationList.totalCount
                                : state.conversationList.totalCount + 1,
                        },
                    };
                });
            });
        }

        await Promise.all([
            get().loadSettings(),
            get().loadProviderCatalog(),
            get().loadConversations(),
            get().scanLocalModels(),
        ]);
        set({ initialized: true });
    },

    loadSettings: async () => {
        const settings = await window.api.ai.getSettings();
        set({ settings });
    },

    loadProviderCatalog: async () => {
        const providerCatalog = await window.api.ai.getProviderCatalog();
        set({ providerCatalog });
    },

    saveSettings: async (partial) => {
        const settings = await window.api.ai.updateSettings(partial);
        set({ settings });
        window.dispatchEvent(new Event(APP_UI_EVENT.aiSettingsUpdated));
    },

    loadConversations: async () => {
        set({ loadingConversationList: true, error: null });

        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: 0,
            });
            const activeConversationId = resolvePersistedActiveConversationId(
                page.conversations,
                get().activeConversationId,
            );

            set({
                conversations: page.conversations,
                conversationList: createConversationListState(page),
                activeConversationId,
                loadingConversationList: false,
            });

            if (activeConversationId) {
                await get().selectConversation(activeConversationId);
            }
        } catch (error) {
            set({
                loadingConversationList: false,
                error: toErrorMessage(error, 'Le chargement des conversations a échoué.'),
            });
        }
    },

    loadOlderConversations: async () => {
        const state = get();
        if (
            !state.conversationList.hasMore ||
            state.loadingConversationList ||
            state.loadingOlderConversationList
        ) {
            return;
        }

        set({ loadingOlderConversationList: true });

        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: state.conversationList.loadedCount,
            });

            set((current) => ({
                conversations: mergeFetchedConversations(current.conversations, page.conversations),
                conversationList: createConversationListState(page),
                loadingOlderConversationList: false,
            }));
        } catch (error) {
            set({
                loadingOlderConversationList: false,
                error: toErrorMessage(error, 'Le chargement des anciennes conversations a échoué.'),
            });
        }
    },

    selectConversation: async (conversationId) => {
        const state = get();
        const alreadyLoaded = conversationId in state.messagesByConversation;
        const alreadyLoading = conversationId in state.loadingConversations;

        if (alreadyLoaded) {
            set((state) => ({
                activeConversationId: conversationId,
                ...pruneConversationCache(state, conversationId),
            }));
            return;
        }

        if (alreadyLoading) {
            set((state) => ({
                activeConversationId: conversationId,
                ...pruneConversationCache(state, conversationId),
            }));
            return;
        }

        set((state) => ({
            activeConversationId: conversationId,
            loadingConversations: {
                ...state.loadingConversations,
                [conversationId]: true,
            },
        }));

        try {
            const page = await window.api.ai.getMessagesPage({
                conversationId,
                limit: AI_MESSAGE_HISTORY_PAGE_SIZE,
                loadedCount: 0,
            });
            const minimizedMessages = minimizeMessagesForRenderer(page.messages);
            set((state) => {
                const nextState = {
                    ...state,
                    activeConversationId: conversationId,
                    loadingConversations: removeConversationKey(
                        state.loadingConversations,
                        conversationId,
                    ),
                    historyByConversation: {
                        ...state.historyByConversation,
                        [conversationId]: createConversationHistoryState(page),
                    },
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversationId]: mergeFetchedMessages(
                            state.messagesByConversation[conversationId] ?? [],
                            minimizedMessages,
                        ),
                    },
                };

                return {
                    activeConversationId: nextState.activeConversationId,
                    ...pruneConversationCache(nextState, conversationId),
                };
            });
        } catch (error) {
            set((state) => ({
                loadingConversations: removeConversationKey(
                    state.loadingConversations,
                    conversationId,
                ),
                error: toErrorMessage(error, 'Le chargement de la conversation a échoué.'),
            }));
        }
    },

    loadOlderMessages: async (conversationId) => {
        const state = get();
        const history = state.historyByConversation[conversationId];

        if (
            !history?.hasMore ||
            conversationId in state.loadingOlderConversations ||
            conversationId in state.loadingConversations
        ) {
            return;
        }

        set((current) => ({
            loadingOlderConversations: {
                ...current.loadingOlderConversations,
                [conversationId]: true,
            },
        }));

        try {
            const page = await window.api.ai.getMessagesPage({
                conversationId,
                limit: AI_MESSAGE_HISTORY_PAGE_SIZE,
                loadedCount: history.loadedCount,
            });
            const minimizedMessages = minimizeMessagesForRenderer(page.messages);

            set((current) => ({
                loadingOlderConversations: removeConversationKey(
                    current.loadingOlderConversations,
                    conversationId,
                ),
                historyByConversation: {
                    ...current.historyByConversation,
                    [conversationId]: createConversationHistoryState(page),
                },
                messagesByConversation: {
                    ...current.messagesByConversation,
                    [conversationId]: mergeFetchedMessages(
                        current.messagesByConversation[conversationId] ?? [],
                        minimizedMessages,
                    ),
                },
            }));
        } catch (error) {
            set((current) => ({
                loadingOlderConversations: removeConversationKey(
                    current.loadingOlderConversations,
                    conversationId,
                ),
                error: toErrorMessage(error, 'Le chargement des anciens messages a échoué.'),
            }));
        }
    },

    createConversation: async (title) => {
        const conversation = await window.api.ai.createConversation({ title });
        set((state) => ({
            conversations: upsertConversation(state.conversations, conversation),
            conversationList: {
                loadedCount: state.conversationList.loadedCount + 1,
                totalCount: state.conversationList.totalCount + 1,
                hasMore: state.conversationList.hasMore,
            },
            activeConversationId: conversation.id,
            historyByConversation: {
                ...state.historyByConversation,
                [conversation.id]: {
                    loadedCount: 0,
                    hasMore: false,
                },
            },
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversation.id]: [],
            },
        }));
    },

    renameConversation: async (conversationId, title) => {
        const conversation = await window.api.ai.renameConversation(conversationId, title);
        set((state) => ({
            conversations: upsertConversation(state.conversations, conversation),
        }));
        return conversation;
    },

    deleteConversation: async (conversationId) => {
        await window.api.ai.deleteConversation(conversationId);

        const remaining = get().conversations.filter(
            (conversation) => conversation.id !== conversationId,
        );
        set((state) => {
            const nextMessages = { ...state.messagesByConversation };
            delete nextMessages[conversationId];
            const removedMessageIds = (state.messagesByConversation[conversationId] ?? []).map(
                (message) => message.id,
            );

            return {
                conversations: remaining,
                conversationList: {
                    loadedCount: Math.max(state.conversationList.loadedCount - 1, remaining.length),
                    totalCount: Math.max(state.conversationList.totalCount - 1, 0),
                    hasMore:
                        state.conversationList.totalCount - 1 >
                        Math.max(state.conversationList.loadedCount - 1, remaining.length),
                },
                activeConversationId:
                    state.activeConversationId === conversationId
                        ? null
                        : state.activeConversationId,
                messagesByConversation: nextMessages,
                reasoningByMessage: removeReasoningByMessageIds(
                    state.reasoningByMessage,
                    removedMessageIds,
                ),
                loadingConversations: removeConversationKey(
                    state.loadingConversations,
                    conversationId,
                ),
                loadingOlderConversations: removeConversationKey(
                    state.loadingOlderConversations,
                    conversationId,
                ),
                historyByConversation: removeConversationKey(
                    state.historyByConversation,
                    conversationId,
                ),
                conversationRuns: removeConversationKey(state.conversationRuns, conversationId),
                queuedMessagesByConversation: removeConversationKey(
                    state.queuedMessagesByConversation,
                    conversationId,
                ),
            };
        });

        const nextConversationId = resolvePersistedActiveConversationId(
            remaining,
            get().activeConversationId,
        );
        if (nextConversationId) {
            await get().selectConversation(nextConversationId);
        }
    },

    exportConversationPdf: async (conversationId) => {
        return window.api.ai.exportConversationPdf(conversationId);
    },

    clearConversations: async () => {
        await window.api.ai.clearConversations();
        set({
            conversations: [],
            conversationList: {
                loadedCount: 0,
                totalCount: 0,
                hasMore: false,
            },
            activeConversationId: null,
            messagesByConversation: {},
            reasoningByMessage: {},
            loadingConversationList: false,
            loadingOlderConversationList: false,
            loadingConversations: {},
            loadingOlderConversations: {},
            historyByConversation: {},
            conversationRuns: {},
            queuedMessagesByConversation: {},
            sending: false,
        });
    },

    sendMessage: async (content) => {
        const trimmed = content.trim();
        if (!trimmed) {
            return false;
        }

        let conversationId = get().activeConversationId;
        if (!conversationId) {
            try {
                const conversation = await window.api.ai.createConversation({});
                conversationId = conversation.id;
                set((state) => ({
                    conversations: upsertConversation(state.conversations, conversation),
                    conversationList: {
                        loadedCount: state.conversationList.loadedCount + 1,
                        totalCount: state.conversationList.totalCount + 1,
                        hasMore: state.conversationList.hasMore,
                    },
                    activeConversationId: conversation.id,
                    historyByConversation: {
                        ...state.historyByConversation,
                        [conversation.id]: {
                            loadedCount: 0,
                            hasMore: false,
                        },
                    },
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversation.id]: [],
                    },
                }));
            } catch (error) {
                set({
                    error: toErrorMessage(error, 'La création de la conversation a échoué.'),
                });
                return false;
            }
        }

        const shouldStartImmediately = !get().conversationRuns[conversationId];

        const queuedMessage = createQueuedMessage(trimmed);
        set((state) => ({
            queuedMessagesByConversation: {
                ...state.queuedMessagesByConversation,
                [conversationId]: [
                    ...(state.queuedMessagesByConversation[conversationId] ?? []),
                    queuedMessage,
                ],
            },
            error: null,
        }));

        if (shouldStartImmediately) {
            void get().flushQueuedMessages(conversationId, { requeueOnFailure: false });
        }

        return true;
    },

    sendMessageNow: async (conversationId, messages) => {
        const generationId = crypto.randomUUID();

        set((state) => ({
            conversationRuns: {
                ...state.conversationRuns,
                [conversationId]: {
                    generationId,
                    assistantMessageId: null,
                    status: 'starting',
                },
            },
            sending: true,
            error: null,
        }));

        try {
            const result: AiSendMessageResult = await window.api.ai.sendMessage({
                conversationId,
                messages,
                generationId,
            });

            markFeatureReminderUsed('ai');

            set((state) => {
                const resolvedConversationId = result.conversation.id;
                const existingMessages =
                    state.messagesByConversation[resolvedConversationId] ??
                    state.messagesByConversation[conversationId] ??
                    [];
                const existingHistory =
                    state.historyByConversation[resolvedConversationId] ??
                    state.historyByConversation[conversationId];
                const messagesWithUsers = result.userMessages.reduce(
                    (acc, message) => upsertMessage(acc, message),
                    existingMessages,
                );
                const minimizedAssistantMessage = minimizeMessageForRenderer(
                    result.assistantMessage,
                );
                const currentRun = state.conversationRuns[conversationId];

                if (!currentRun || currentRun.generationId !== generationId) {
                    return {
                        conversations: upsertConversation(state.conversations, result.conversation),
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [resolvedConversationId]: messagesWithUsers,
                        },
                    };
                }

                const nextMessages = upsertMessage(messagesWithUsers, minimizedAssistantMessage);
                const recentWindow = keepRecentMessages(nextMessages);

                return {
                    conversations: upsertConversation(state.conversations, result.conversation),
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [resolvedConversationId]: recentWindow.messages,
                    },
                    reasoningByMessage: removeReasoningByMessageIds(
                        state.reasoningByMessage,
                        recentWindow.removedMessageIds,
                    ),
                    historyByConversation: {
                        ...state.historyByConversation,
                        [resolvedConversationId]: updateRecentHistoryWindow(
                            existingHistory,
                            recentWindow.messages.length,
                            recentWindow.wasTrimmed,
                        ),
                    },
                    activeConversationId: resolvedConversationId,
                    conversationRuns: moveConversationRun(
                        state.conversationRuns,
                        conversationId,
                        resolvedConversationId,
                        (run) => ({
                            ...run,
                            assistantMessageId: result.assistantMessage.id,
                            status: 'streaming',
                        }),
                    ),
                };
            });

            return true;
        } catch (error) {
            set((state) => {
                const currentRun = state.conversationRuns[conversationId];
                if (!currentRun || currentRun.generationId !== generationId) {
                    return state;
                }

                const conversationRuns = removeConversationKey(
                    state.conversationRuns,
                    conversationId,
                );
                return {
                    conversationRuns,
                    sending: countRuns(conversationRuns) > 0,
                    error: toErrorMessage(error, "L'envoi du message a échoué."),
                };
            });

            return false;
        }
    },

    retryLastUserMessage: async (conversationId, messageId) => {
        const lastMessage = getLastConversationMessage(
            get().messagesByConversation,
            conversationId,
        );
        if (!lastMessage || lastMessage.id !== messageId || lastMessage.role !== 'user') {
            return false;
        }

        const generationId = crypto.randomUUID();

        set((state) => ({
            conversationRuns: {
                ...state.conversationRuns,
                [conversationId]: {
                    generationId,
                    assistantMessageId: null,
                    status: 'starting',
                },
            },
            sending: true,
            error: null,
        }));

        try {
            const result: AiRetryMessageResult = await window.api.ai.retryMessage({
                conversationId,
                lastUserMessageId: messageId,
                generationId,
            });

            set((state) => {
                const currentRun = state.conversationRuns[conversationId];
                if (!currentRun || currentRun.generationId !== generationId) {
                    return state;
                }

                const nextMessages = upsertMessage(
                    state.messagesByConversation[conversationId] ?? [],
                    minimizeMessageForRenderer(result.assistantMessage),
                );
                const recentWindow = keepRecentMessages(nextMessages);

                return {
                    conversations: upsertConversation(state.conversations, result.conversation),
                    activeConversationId: result.conversation.id,
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversationId]: recentWindow.messages,
                    },
                    reasoningByMessage: removeReasoningByMessageIds(
                        state.reasoningByMessage,
                        recentWindow.removedMessageIds,
                    ),
                    historyByConversation: {
                        ...state.historyByConversation,
                        [conversationId]: updateRecentHistoryWindow(
                            state.historyByConversation[conversationId],
                            recentWindow.messages.length,
                            recentWindow.wasTrimmed,
                        ),
                    },
                    conversationRuns: {
                        ...state.conversationRuns,
                        [conversationId]: {
                            ...currentRun,
                            assistantMessageId: result.assistantMessage.id,
                            status: 'streaming',
                        },
                    },
                };
            });

            return true;
        } catch (error) {
            set((state) => {
                const currentRun = state.conversationRuns[conversationId];
                if (!currentRun || currentRun.generationId !== generationId) {
                    return state;
                }

                const conversationRuns = removeConversationKey(
                    state.conversationRuns,
                    conversationId,
                );

                return {
                    conversationRuns,
                    sending: countRuns(conversationRuns) > 0,
                    error: toErrorMessage(error, 'La relance de la réponse a échoué.'),
                };
            });

            return false;
        }
    },

    flushQueuedMessages: async (conversationId, options) => {
        if (get().conversationRuns[conversationId]) {
            return false;
        }

        const queuedMessages = get().queuedMessagesByConversation[conversationId] ?? [];
        if (queuedMessages.length === 0) {
            return false;
        }

        const batchMessages = queuedMessages.map((message) => message.content);

        set((state) => ({
            queuedMessagesByConversation: removeConversationKey(
                state.queuedMessagesByConversation,
                conversationId,
            ),
        }));

        const sent = await get().sendMessageNow(conversationId, batchMessages);
        if (!sent) {
            const requeueOnFailure = options?.requeueOnFailure ?? true;
            if (!requeueOnFailure) {
                return false;
            }

            set((state) => ({
                queuedMessagesByConversation: {
                    ...state.queuedMessagesByConversation,
                    [conversationId]: [
                        ...queuedMessages,
                        ...(state.queuedMessagesByConversation[conversationId] ?? []),
                    ],
                },
            }));
        }

        return sent;
    },

    removeQueuedMessage: (conversationId, queuedMessageId) => {
        set((state) => {
            const currentQueue = state.queuedMessagesByConversation[conversationId] ?? [];
            const nextQueue = currentQueue.filter((message) => message.id !== queuedMessageId);

            return {
                queuedMessagesByConversation:
                    nextQueue.length > 0
                        ? {
                              ...state.queuedMessagesByConversation,
                              [conversationId]: nextQueue,
                          }
                        : removeConversationKey(state.queuedMessagesByConversation, conversationId),
            };
        });
    },

    stopGeneration: async () => {
        const conversationId = get().activeConversationId;
        if (!conversationId) {
            return;
        }

        const run = get().conversationRuns[conversationId];
        if (!run) {
            return;
        }

        set((state) => ({
            conversationRuns: {
                ...state.conversationRuns,
                [conversationId]: {
                    ...run,
                    status: 'stopping',
                },
            },
        }));

        try {
            await window.api.ai.stopGeneration(conversationId);
        } catch (error) {
            set((state) => {
                const currentRun = state.conversationRuns[conversationId];
                if (!currentRun || currentRun.generationId !== run.generationId) {
                    return state;
                }

                return {
                    conversationRuns: {
                        ...state.conversationRuns,
                        [conversationId]: {
                            ...currentRun,
                            status: 'streaming',
                        },
                    },
                    error: toErrorMessage(error, "L'arrêt de la génération a échoué."),
                };
            });
        }
    },

    scanLocalModels: async () => {
        try {
            const localModels = await window.api.ai.scanLocalModels();
            set({ localModels });
        } catch (error) {
            set({
                error: toErrorMessage(error, 'Le scan des modèles locaux a échoué.'),
            });
        }
    },

    testProvider: async (input) => {
        return window.api.ai.testProvider(input);
    },

    downloadModel: async (modelId) => {
        await window.api.ai.downloadModel(modelId);
    },
}));

export function selectActiveProviderLabel(state: AiChatState): string {
    const { settings, providerCatalog } = state;
    if (!settings?.activeProvider) {
        return '';
    }

    const providerName = resolveProviderName(settings, providerCatalog) ?? '';
    const model = resolveActiveModel(settings) ?? '';
    return model ? `${providerName} — ${model}` : providerName;
}
