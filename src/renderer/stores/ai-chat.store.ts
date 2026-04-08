import type {
    AiConversation,
    AiMessage,
    AiModelScanResult,
    AiProviderDefinition,
    AiProviderTestResult,
    AiSendMessageResult,
    AiSettings,
} from '@shared/ai.types';
import { resolveActiveModel, resolveProviderName } from '@shared/ai.types';
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

type ConversationRunStatus = 'starting' | 'streaming' | 'stopping';

interface ConversationRunState {
    generationId: string;
    assistantMessageId: string | null;
    status: ConversationRunStatus;
}

interface QueuedMessage {
    id: string;
    content: string;
    createdAt: string;
}

type ConversationRunMap = Record<string, ConversationRunState>;
type QueuedMessageMap = Record<string, QueuedMessage[]>;

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
        return [conversation, ...conversations];
    }

    return conversations.map((item, index) => (index === existing ? conversation : item));
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

function buildQueuedBatch(messages: QueuedMessage[]): string {
    return messages.map((message) => message.content).join('\n\n');
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

let listenersBound = false;

interface AiChatState {
    initialized: boolean;
    settings: AiSettings | null;
    providerCatalog: AiProviderDefinition[];
    conversations: AiConversation[];
    activeConversationId: string | null;
    messagesByConversation: MessageMap;
    reasoningByMessage: ReasoningMap;
    loadingConversations: LoadingConversationMap;
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
    selectConversation(conversationId: string): Promise<void>;
    createConversation(title?: string): Promise<void>;
    deleteConversation(conversationId: string): Promise<void>;
    clearConversations(): Promise<void>;
    sendMessage(content: string): Promise<boolean>;
    sendMessageNow(conversationId: string, content: string): Promise<boolean>;
    flushQueuedMessages(conversationId: string): Promise<boolean>;
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
    activeConversationId: null,
    messagesByConversation: {},
    reasoningByMessage: {},
    loadingConversations: {},
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
                    shouldFlushQueue =
                        (state.queuedMessagesByConversation[conversationId] ?? []).length > 0;

                    return {
                        conversationRuns,
                        sending: countRuns(conversationRuns) > 0,
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
                set((state) => ({
                    conversations: upsertConversation(state.conversations, conversation),
                }));
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
        const conversations = await window.api.ai.getConversations();
        const activeConversationId = get().activeConversationId ?? conversations[0]?.id ?? null;

        set({ conversations });

        if (activeConversationId) {
            await get().selectConversation(activeConversationId);
        } else {
            set({ activeConversationId: null });
        }
    },

    selectConversation: async (conversationId) => {
        set((state) => ({
            activeConversationId: conversationId,
            loadingConversations: {
                ...state.loadingConversations,
                [conversationId]: true,
            },
        }));

        try {
            const messages = await window.api.ai.getMessages(conversationId);
            set((state) => ({
                activeConversationId: conversationId,
                loadingConversations: removeConversationKey(
                    state.loadingConversations,
                    conversationId,
                ),
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: messages,
                },
            }));
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

    createConversation: async (title) => {
        const conversation = await window.api.ai.createConversation({ title });
        set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id,
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversation.id]: [],
            },
        }));
    },

    deleteConversation: async (conversationId) => {
        await window.api.ai.deleteConversation(conversationId);

        const remaining = get().conversations.filter(
            (conversation) => conversation.id !== conversationId,
        );
        set((state) => {
            const nextMessages = { ...state.messagesByConversation };
            delete nextMessages[conversationId];

            return {
                conversations: remaining,
                activeConversationId:
                    state.activeConversationId === conversationId
                        ? null
                        : state.activeConversationId,
                messagesByConversation: nextMessages,
                loadingConversations: removeConversationKey(
                    state.loadingConversations,
                    conversationId,
                ),
                conversationRuns: removeConversationKey(state.conversationRuns, conversationId),
                queuedMessagesByConversation: removeConversationKey(
                    state.queuedMessagesByConversation,
                    conversationId,
                ),
            };
        });

        const nextConversationId = get().activeConversationId ?? remaining[0]?.id ?? null;
        if (nextConversationId) {
            await get().selectConversation(nextConversationId);
        }
    },

    clearConversations: async () => {
        await window.api.ai.clearConversations();
        set({
            conversations: [],
            activeConversationId: null,
            messagesByConversation: {},
            reasoningByMessage: {},
            loadingConversations: {},
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
                    conversations: [conversation, ...state.conversations],
                    activeConversationId: conversation.id,
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

        if (!get().conversationRuns[conversationId]) {
            void get().flushQueuedMessages(conversationId);
        }

        return true;
    },

    sendMessageNow: async (conversationId, content) => {
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
                content,
                generationId,
            });

            markFeatureReminderUsed('ai');

            set((state) => {
                const resolvedConversationId = result.conversation.id;
                const existingMessages =
                    state.messagesByConversation[resolvedConversationId] ??
                    state.messagesByConversation[conversationId] ??
                    [];
                const messagesWithUser = upsertMessage(existingMessages, result.userMessage);
                const currentRun = state.conversationRuns[conversationId];

                if (!currentRun || currentRun.generationId !== generationId) {
                    return {
                        conversations: upsertConversation(state.conversations, result.conversation),
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [resolvedConversationId]: messagesWithUser,
                        },
                    };
                }

                const nextMessages = upsertMessage(messagesWithUser, result.assistantMessage);

                return {
                    conversations: upsertConversation(state.conversations, result.conversation),
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [resolvedConversationId]: nextMessages,
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

    flushQueuedMessages: async (conversationId) => {
        if (get().conversationRuns[conversationId]) {
            return false;
        }

        const queuedMessages = get().queuedMessagesByConversation[conversationId] ?? [];
        if (queuedMessages.length === 0) {
            return false;
        }

        const batchContent = buildQueuedBatch(queuedMessages);

        set((state) => ({
            queuedMessagesByConversation: removeConversationKey(
                state.queuedMessagesByConversation,
                conversationId,
            ),
        }));

        const sent = await get().sendMessageNow(conversationId, batchContent);
        if (!sent) {
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
