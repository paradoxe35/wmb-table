import type {
    AiConversation,
    AiMessage,
    AiProviderDefinition,
    AiProviderTestResult,
    AiSettings,
} from '@shared/ai.types';
import type { PdfExportResult } from '@shared/ipc.types';
import {
    AI_CONVERSATION_HISTORY_PAGE_SIZE,
    AI_MESSAGE_HISTORY_PAGE_SIZE,
    AI_MESSAGE_MAX_LENGTH,
    AI_MESSAGE_TOO_LONG_ERROR,
    resolveActiveModel,
    resolveProviderName,
} from '@shared/ai.types';
import { APP_UI_EVENT } from '@renderer/utils/events';
import { createStore } from './create-store';
import { createAiSettingsSaveQueue, type AiSettingsUpdate } from './ai-settings-save-queue';
import { markFeatureReminderUsed } from '@renderer/lib/feature-reminders';
import {
    dataEventForToolResult,
    toolResultFromEvent,
    withToolCallCompleted,
    withToolCallStarted,
} from './ai-chat-run-events';
import type {
    ChatRunState,
    ConversationHistoryMap,
    LoadingConversationMap,
    QueuedMessage,
} from './ai-chat/chat-state';
import {
    applyConversationUpdate,
    createConversationListState,
    EMPTY_CONVERSATION_LIST,
    findKnownConversation,
    keepOpenConversation,
    mergeFetchedConversations,
    resolvePersistedActiveConversationId,
    upsertConversation,
    type ConversationListState,
} from './ai-chat/conversation-list';
import {
    createConversationHistoryState,
    mergeFetchedMessages,
    minimizeMessagesForRenderer,
    pruneConversationCache,
    removeConversationKey,
    removeReasoningByMessageIds,
    updateConversationMessages,
} from './ai-chat/message-cache';
import { applyRunEnd, type RunEnd } from './ai-chat/run-end';
import { applyRunStarted, failRun, startRun } from './ai-chat/run-start';

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

function canRetryUserMessage(messages: AiMessage[], messageId: string): boolean {
    const messageIndex = messages.findIndex((message) => message.id === messageId);
    if (messageIndex === -1 || messages[messageIndex].role !== 'user') {
        return false;
    }

    const trailingMessages = messages.slice(messageIndex + 1);
    return trailingMessages.every(
        (message) => message.role === 'assistant' && !message.content.trim(),
    );
}

let listenersBound = false;
let initialization: Promise<void> | null = null;
let pendingConversation: Promise<AiConversation> | null = null;

interface AiChatState extends ChatRunState {
    initialized: boolean;
    settings: AiSettings | null;
    providerCatalog: AiProviderDefinition[];
    conversations: AiConversation[];
    conversationList: ConversationListState;
    loadingConversationList: boolean;
    loadingOlderConversationList: boolean;
    loadingConversations: LoadingConversationMap;
    loadingOlderConversations: LoadingConversationMap;
    historyByConversation: ConversationHistoryMap;
    /** List, search and other errors that belong to no single conversation */
    error: string | null;
    conversationSearch: string;
    /** Metadata for the open conversation when it falls outside the paged window */
    activeConversationRecord: AiConversation | null;
    /** Null while no search is active, so the sidebar can fall back to `conversations` */
    searchResults: AiConversation[] | null;
    searchList: ConversationListState;
    loadingConversationSearch: boolean;
    loadingOlderConversationSearch: boolean;

    initialize(): Promise<void>;
    loadSettings(): Promise<void>;
    loadProviderCatalog(): Promise<void>;
    saveSettings(update: AiSettingsUpdate): Promise<void>;
    whenSettingsSaved(): Promise<void>;
    loadConversations(): Promise<void>;
    refreshAfterSync(): Promise<void>;
    loadOlderConversations(): Promise<void>;
    searchConversations(term: string): Promise<void>;
    loadOlderSearchResults(): Promise<void>;
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
    clearError(): void;
    testProvider(input: {
        providerId: string;
        model: string;
        apiKey?: string;
        baseUrl?: string;
    }): Promise<AiProviderTestResult>;
}

function withCreatedConversation(
    state: Pick<
        AiChatState,
        'conversations' | 'conversationList' | 'historyByConversation' | 'messagesByConversation'
    >,
    conversation: AiConversation,
): Partial<AiChatState> {
    return {
        conversations: upsertConversation(state.conversations, conversation),
        conversationList: {
            ...state.conversationList,
            loadedCount: state.conversationList.loadedCount + 1,
            totalCount: state.conversationList.totalCount + 1,
        },
        activeConversationId: conversation.id,
        activeConversationRecord: conversation,
        historyByConversation: {
            ...state.historyByConversation,
            [conversation.id]: { loadedCount: 0, hasMore: false },
        },
        messagesByConversation: { ...state.messagesByConversation, [conversation.id]: [] },
    };
}

/** Two quick sends on the empty screen share one new conversation. */
function createConversationForFirstMessage(): Promise<AiConversation> {
    pendingConversation ??= window.api.ai
        .createConversation({})
        .then((conversation) => {
            useAiChatStore.setState((state) => withCreatedConversation(state, conversation));
            return conversation;
        })
        .finally(() => {
            pendingConversation = null;
        });
    return pendingConversation;
}

function applyStartedRun(
    conversationId: string,
    generationId: string,
    started: Parameters<typeof applyRunStarted>[3],
): void {
    let stopConversationId: string | null = null;
    useAiChatStore.setState((state) => {
        const update = applyRunStarted(state, conversationId, generationId, started);
        stopConversationId = update.stopConversationId;
        return update.state;
    });

    if (stopConversationId) {
        window.api.ai.stopGeneration(stopConversationId).catch((error: unknown) => {
            useAiChatStore.setState({
                error: toErrorMessage(error, "L'arrêt de la génération a échoué."),
            });
        });
    }
}

const settingsSaveQueue = createAiSettingsSaveQueue({
    current: () => useAiChatStore.getState().settings,
    save: (partial) => window.api.ai.updateSettings(partial),
    applied: (settings) => {
        useAiChatStore.setState({ settings });
        window.dispatchEvent(new Event(APP_UI_EVENT.aiSettingsUpdated));
    },
});

export const useAiChatStore = createStore<AiChatState>((set, get) => ({
    initialized: false,
    settings: null,
    providerCatalog: [],
    conversations: [],
    conversationList: EMPTY_CONVERSATION_LIST,
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
    runNoticeByConversation: {},
    error: null,
    completionCount: 0,
    lastCompletedConversationId: null,
    conversationSearch: '',
    activeConversationRecord: null,
    searchResults: null,
    searchList: EMPTY_CONVERSATION_LIST,
    loadingConversationSearch: false,
    loadingOlderConversationSearch: false,

    initialize: () => {
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

            window.api.on.aiToolCallStart((event) => {
                set((state) => {
                    const run = state.conversationRuns[event.conversationId];
                    if (!run || run.generationId !== event.generationId) {
                        return state;
                    }

                    return {
                        messagesByConversation: updateConversationMessages(
                            state.messagesByConversation,
                            event.conversationId,
                            (messages) => withToolCallStarted(messages, event),
                        ),
                    };
                });
            });

            window.api.on.aiToolCallComplete((event) => {
                const result = toolResultFromEvent(event);
                set((state) => {
                    const run = state.conversationRuns[event.conversationId];
                    if (!run || run.generationId !== event.generationId) {
                        return state;
                    }

                    return {
                        messagesByConversation: updateConversationMessages(
                            state.messagesByConversation,
                            event.conversationId,
                            (messages) => withToolCallCompleted(messages, result, event.messageId),
                        ),
                    };
                });

                const dataEvent = dataEventForToolResult(result);
                if (dataEvent) {
                    window.dispatchEvent(new Event(dataEvent));
                }
            });

            const endRun = (end: RunEnd) => {
                let shouldFlushQueue = false;
                set((state) => {
                    const update = applyRunEnd(state, end);
                    shouldFlushQueue = update?.shouldFlushQueue ?? false;
                    return update?.state ?? state;
                });

                if (shouldFlushQueue) {
                    void get().flushQueuedMessages(end.event.conversationId);
                }
            };

            window.api.on.aiStreamComplete((event) => endRun({ kind: 'complete', event }));
            window.api.on.aiStreamCancel((event) => endRun({ kind: 'cancel', event }));
            window.api.on.aiStreamError((event) => endRun({ kind: 'error', event }));

            window.api.on.aiConversationUpdated(({ conversation }) => {
                set((state) => applyConversationUpdate(state, conversation));
            });
        }

        if (initialization) {
            return get().initialized ? get().loadSettings() : initialization;
        }

        initialization = Promise.all([
            get().loadSettings(),
            get().loadProviderCatalog(),
            get().loadConversations(),
        ]).then(
            () => set({ initialized: true }),
            (error: unknown) => {
                initialization = null;
                throw error;
            },
        );
        return initialization;
    },

    loadSettings: async () => {
        const settings = await window.api.ai.getSettings();
        set({ settings });
    },

    loadProviderCatalog: async () => {
        const providerCatalog = await window.api.ai.getProviderCatalog();
        set({ providerCatalog });
    },

    saveSettings: (update) => settingsSaveQueue.enqueue(update),

    whenSettingsSaved: () => settingsSaveQueue.settled(),

    loadConversations: async () => {
        set({ loadingConversationList: true, error: null });

        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: 0,
            });
            const { activeConversationId, activeConversationRecord } = keepOpenConversation(
                get(),
                page.conversations,
            );

            set({
                conversations: page.conversations,
                conversationList: createConversationListState(page),
                activeConversationId,
                activeConversationRecord,
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

    refreshAfterSync: async () => {
        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: 0,
            });
            const { activeConversationId, activeConversationRecord } = keepOpenConversation(
                get(),
                page.conversations,
            );

            set((state) => ({
                conversations: page.conversations,
                conversationList: createConversationListState(page),
                activeConversationId,
                activeConversationRecord,
                ...pruneConversationCache(state, activeConversationId),
            }));

            if (!activeConversationId || get().conversationRuns[activeConversationId]) {
                return;
            }

            const messagePage = await window.api.ai.getMessagesPage({
                conversationId: activeConversationId,
                limit: AI_MESSAGE_HISTORY_PAGE_SIZE,
                loadedCount: 0,
            });
            const minimizedMessages = minimizeMessagesForRenderer(messagePage.messages);

            set((state) => {
                if (state.activeConversationId !== activeConversationId) {
                    return {};
                }

                const nextState = {
                    ...state,
                    historyByConversation: {
                        ...state.historyByConversation,
                        [activeConversationId]: createConversationHistoryState(messagePage),
                    },
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [activeConversationId]: minimizedMessages,
                    },
                };

                return pruneConversationCache(nextState, activeConversationId);
            });
        } catch (error) {
            set({
                error: toErrorMessage(error, 'Le rafraîchissement des conversations a échoué.'),
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

    searchConversations: async (term) => {
        const trimmed = term.trim();
        set({ conversationSearch: term });

        if (!trimmed) {
            set({
                searchResults: null,
                searchList: EMPTY_CONVERSATION_LIST,
                loadingConversationSearch: false,
                loadingOlderConversationSearch: false,
            });
            return;
        }

        set({ loadingConversationSearch: true });

        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: 0,
                search: trimmed,
            });

            set((state) => {
                // A later keystroke already replaced this query
                if (state.conversationSearch.trim() !== trimmed) {
                    return {};
                }

                return {
                    searchResults: page.conversations,
                    searchList: createConversationListState(page),
                    loadingConversationSearch: false,
                };
            });
        } catch (error) {
            set({
                loadingConversationSearch: false,
                error: toErrorMessage(error, 'La recherche de conversations a échoué.'),
            });
        }
    },

    loadOlderSearchResults: async () => {
        const state = get();
        const term = state.conversationSearch.trim();

        if (
            !term ||
            !state.searchList.hasMore ||
            state.loadingConversationSearch ||
            state.loadingOlderConversationSearch
        ) {
            return;
        }

        set({ loadingOlderConversationSearch: true });

        try {
            const page = await window.api.ai.getConversationsPage({
                limit: AI_CONVERSATION_HISTORY_PAGE_SIZE,
                loadedCount: state.searchList.loadedCount,
                search: term,
            });

            set((current) => {
                if (current.conversationSearch.trim() !== term) {
                    return { loadingOlderConversationSearch: false };
                }

                return {
                    searchResults: mergeFetchedConversations(
                        current.searchResults ?? [],
                        page.conversations,
                    ),
                    searchList: createConversationListState(page),
                    loadingOlderConversationSearch: false,
                };
            });
        } catch (error) {
            set({
                loadingOlderConversationSearch: false,
                error: toErrorMessage(error, 'La recherche de conversations a échoué.'),
            });
        }
    },

    selectConversation: async (conversationId) => {
        // Remember the metadata without touching the paged list, so a conversation
        // opened from search does not appear out of order once the search clears
        set((current) => ({
            activeConversationRecord: findKnownConversation(current, conversationId),
            error: current.activeConversationId === conversationId ? current.error : null,
        }));

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
                if (state.activeConversationId !== conversationId) {
                    return {
                        loadingConversations: removeConversationKey(
                            state.loadingConversations,
                            conversationId,
                        ),
                    };
                }

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
        if (!title) {
            const state = get();
            const reusable = state.conversations.find(
                (conversation) =>
                    state.messagesByConversation[conversation.id]?.length === 0 &&
                    !state.conversationRuns[conversation.id] &&
                    !state.queuedMessagesByConversation[conversation.id],
            );
            if (reusable) {
                if (reusable.id !== state.activeConversationId) {
                    await get().selectConversation(reusable.id);
                }
                return;
            }
        }

        try {
            const conversation = await window.api.ai.createConversation({ title });
            set((state) => withCreatedConversation(state, conversation));
        } catch (error) {
            set({ error: toErrorMessage(error, 'La création de la conversation a échoué.') });
        }
    },

    renameConversation: async (conversationId, title) => {
        const conversation = await window.api.ai.renameConversation(conversationId, title);
        set((state) => ({
            conversations: upsertConversation(state.conversations, conversation),
            searchResults:
                state.searchResults?.map((item) =>
                    item.id === conversation.id ? conversation : item,
                ) ?? null,
            activeConversationRecord:
                state.activeConversationRecord?.id === conversation.id
                    ? conversation
                    : state.activeConversationRecord,
        }));
        return conversation;
    },

    deleteConversation: async (conversationId) => {
        if (get().conversationRuns[conversationId]) {
            set({ error: 'Une génération est en cours.' });
            return;
        }

        try {
            await window.api.ai.deleteConversation(conversationId);
        } catch (error) {
            set({ error: toErrorMessage(error, 'La suppression de la conversation a échoué.') });
            return;
        }

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
                searchResults:
                    state.searchResults?.filter(
                        (conversation) => conversation.id !== conversationId,
                    ) ?? null,
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
                activeConversationRecord:
                    state.activeConversationRecord?.id === conversationId
                        ? null
                        : state.activeConversationRecord,
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
                runNoticeByConversation: removeConversationKey(
                    state.runNoticeByConversation,
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
        if (Object.keys(get().conversationRuns).length > 0) {
            set({ error: 'Une génération est en cours.' });
            return;
        }

        try {
            await window.api.ai.clearConversations();
        } catch (error) {
            set({ error: toErrorMessage(error, "La suppression de l'historique a échoué.") });
            return;
        }

        set({
            conversations: [],
            conversationList: EMPTY_CONVERSATION_LIST,
            activeConversationId: null,
            activeConversationRecord: null,
            messagesByConversation: {},
            reasoningByMessage: {},
            loadingConversationList: false,
            loadingOlderConversationList: false,
            loadingConversations: {},
            loadingOlderConversations: {},
            historyByConversation: {},
            conversationRuns: {},
            queuedMessagesByConversation: {},
            runNoticeByConversation: {},
            conversationSearch: '',
            searchResults: null,
            searchList: EMPTY_CONVERSATION_LIST,
            loadingConversationSearch: false,
            loadingOlderConversationSearch: false,
        });
    },

    sendMessage: async (content) => {
        const trimmed = content.trim();
        if (!trimmed) {
            return false;
        }

        if (trimmed.length > AI_MESSAGE_MAX_LENGTH) {
            set({ error: AI_MESSAGE_TOO_LONG_ERROR });
            return false;
        }

        let conversationId = get().activeConversationId;
        if (!conversationId) {
            try {
                conversationId = (await createConversationForFirstMessage()).id;
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
            void get().flushQueuedMessages(conversationId);
        }

        return true;
    },

    sendMessageNow: async (conversationId, messages) => {
        const generationId = crypto.randomUUID();
        set((state) => startRun(state, conversationId, generationId));

        try {
            const result = await window.api.ai.sendMessage({
                conversationId,
                messages,
                generationId,
            });
            markFeatureReminderUsed('ai');
            applyStartedRun(conversationId, generationId, result);
            return true;
        } catch (error) {
            const detail = toErrorMessage(error, "L'envoi du message a échoué.");
            set((state) => failRun(state, conversationId, generationId, detail) ?? state);
            return false;
        }
    },

    retryLastUserMessage: async (conversationId, messageId) => {
        const state = get();
        const messages = state.messagesByConversation[conversationId] ?? [];
        if (state.conversationRuns[conversationId] || !canRetryUserMessage(messages, messageId)) {
            return false;
        }

        const generationId = crypto.randomUUID();
        set((current) => startRun(current, conversationId, generationId));

        try {
            const result = await window.api.ai.retryMessage({
                conversationId,
                lastUserMessageId: messageId,
                generationId,
            });
            applyStartedRun(conversationId, generationId, { ...result, userMessages: [] });
            return true;
        } catch (error) {
            const detail = toErrorMessage(error, 'La relance de la réponse a échoué.');
            set((current) => failRun(current, conversationId, generationId, detail) ?? current);
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

    clearError: () => set({ error: null }),

    testProvider: async (input) => {
        return window.api.ai.testProvider(input);
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
