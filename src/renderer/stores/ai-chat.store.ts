import { create } from 'zustand';
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
import { AI_DATA_EVENT } from '@renderer/utils/events';

const TOOL_TO_EVENT: Record<string, string> = {
    createNote: AI_DATA_EVENT.notesChanged,
    updateNoteContent: AI_DATA_EVENT.notesChanged,
    addSermonReferenceToNote: AI_DATA_EVENT.notesChanged,
    createSubject: AI_DATA_EVENT.subjectsChanged,
    addSermonReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
    addBibleReferenceToSubject: AI_DATA_EVENT.subjectsChanged,
};

type MessageMap = Record<string, AiMessage[]>;
type ReasoningMap = Record<string, string>;

interface AiChatState {
    initialized: boolean;
    settings: AiSettings | null;
    providerCatalog: AiProviderDefinition[];
    conversations: AiConversation[];
    activeConversationId: string | null;
    messagesByConversation: MessageMap;
    reasoningByMessage: ReasoningMap;
    localModels: AiModelScanResult | null;
    sending: boolean;
    error: string | null;

    initialize(): Promise<void>;
    loadSettings(): Promise<void>;
    loadProviderCatalog(): Promise<void>;
    saveSettings(partial: Partial<AiSettings>): Promise<void>;
    loadConversations(): Promise<void>;
    selectConversation(conversationId: string): Promise<void>;
    createConversation(title?: string): Promise<void>;
    deleteConversation(conversationId: string): Promise<void>;
    clearConversations(): Promise<void>;
    sendMessage(content: string, overrideLanguageCode?: string): Promise<void>;
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

function upsertMessage(messages: AiMessage[], message: AiMessage): AiMessage[] {
    const index = messages.findIndex((item) => item.id === message.id);
    if (index === -1) return [...messages, message];
    return messages.map((item, itemIndex) => (itemIndex === index ? message : item));
}

function stripIpcPrefix(message: string): string {
    // Electron wraps IPC errors as: "Error invoking remote method '<channel>': Error: <actual message>"
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

let listenersBound = false;

export const useAiChatStore = create<AiChatState>((set, get) => ({
    initialized: false,
    settings: null,
    providerCatalog: [],
    conversations: [],
    activeConversationId: null,
    messagesByConversation: {},
    reasoningByMessage: {},
    localModels: null,
    sending: false,
    error: null,

    initialize: async () => {
        if (!listenersBound) {
            listenersBound = true;
            window.api.on.aiStreamChunk(({ conversationId, messageId, delta }) => {
                set((state) => ({
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map(
                            (message) =>
                                message.id === messageId
                                    ? { ...message, content: `${message.content}${delta}` }
                                    : message,
                        ),
                    },
                }));
            });
            window.api.on.aiReasoningDelta(({ messageId, delta }) => {
                set((state) => ({
                    reasoningByMessage: {
                        ...state.reasoningByMessage,
                        [messageId]: (state.reasoningByMessage[messageId] ?? '') + delta,
                    },
                }));
            });
            window.api.on.aiToolCallStart(
                ({ conversationId, messageId, toolName, toolCallId, payload }) => {
                    set((state) => ({
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [conversationId]: (
                                state.messagesByConversation[conversationId] ?? []
                            ).map((message) =>
                                message.id === messageId
                                    ? {
                                          ...message,
                                          toolCalls: [
                                              ...message.toolCalls,
                                              {
                                                  id: toolCallId,
                                                  name: toolName,
                                                  input: (payload as Record<string, unknown>) ?? {},
                                              },
                                          ],
                                      }
                                    : message,
                            ),
                        },
                    }));
                },
            );
            window.api.on.aiToolCallComplete(
                ({ conversationId, messageId, toolName, toolCallId, payload }) => {
                    set((state) => ({
                        messagesByConversation: {
                            ...state.messagesByConversation,
                            [conversationId]: (
                                state.messagesByConversation[conversationId] ?? []
                            ).map((message) =>
                                message.id === messageId
                                    ? {
                                          ...message,
                                          toolResults: [
                                              ...message.toolResults,
                                              { toolCallId, name: toolName, output: payload },
                                          ],
                                      }
                                    : message,
                            ),
                        },
                    }));
                    const event = TOOL_TO_EVENT[toolName];
                    if (event) window.dispatchEvent(new Event(event));
                },
            );
            window.api.on.aiStreamComplete(() => {
                set({ sending: false });
            });
            window.api.on.aiStreamError(({ error }) => {
                set({ sending: false, error });
            });
            window.api.on.aiConversationUpdated(({ conversation }) => {
                set((state) => ({
                    conversations: state.conversations.map((c) =>
                        c.id === conversation.id ? conversation : c,
                    ),
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
        window.dispatchEvent(new Event('ai-settings-updated'));
    },

    loadConversations: async () => {
        const conversations = await window.api.ai.getConversations();
        const activeConversationId = get().activeConversationId ?? conversations[0]?.id ?? null;
        set({ conversations, activeConversationId });
        if (activeConversationId) {
            await get().selectConversation(activeConversationId);
        }
    },

    selectConversation: async (conversationId) => {
        const messages = await window.api.ai.getMessages(conversationId);
        set((state) => ({
            activeConversationId: conversationId,
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: messages,
            },
        }));
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
            const nextMap = { ...state.messagesByConversation };
            delete nextMap[conversationId];
            return {
                conversations: remaining,
                activeConversationId:
                    state.activeConversationId === conversationId
                        ? (remaining[0]?.id ?? null)
                        : state.activeConversationId,
                messagesByConversation: nextMap,
            };
        });
        const nextConversationId = get().activeConversationId;
        if (nextConversationId) {
            await get().selectConversation(nextConversationId);
        }
    },

    clearConversations: async () => {
        await window.api.ai.clearConversations();
        set({ conversations: [], activeConversationId: null, messagesByConversation: {} });
    },

    sendMessage: async (content, overrideLanguageCode) => {
        const trimmed = content.trim();
        if (!trimmed) return;

        let conversationId = get().activeConversationId;
        if (!conversationId) {
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
        }

        set({ sending: true, error: null });
        try {
            const result: AiSendMessageResult = await window.api.ai.sendMessage({
                conversationId,
                content: trimmed,
                overrideLanguageCode,
            });
            set((state) => ({
                conversations: state.conversations.some(
                    (conversation) => conversation.id === result.conversation.id,
                )
                    ? state.conversations.map((conversation) =>
                          conversation.id === result.conversation.id
                              ? result.conversation
                              : conversation,
                      )
                    : [result.conversation, ...state.conversations],
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [result.conversation.id]: upsertMessage(
                        upsertMessage(
                            state.messagesByConversation[result.conversation.id] ?? [],
                            result.userMessage,
                        ),
                        result.assistantMessage,
                    ),
                },
                activeConversationId: result.conversation.id,
            }));
        } catch (error) {
            set({
                sending: false,
                error: toErrorMessage(error, "L'envoi du message a échoué."),
            });
        }
    },

    stopGeneration: async () => {
        const conversationId = get().activeConversationId;
        if (!conversationId) return;
        try {
            await window.api.ai.stopGeneration(conversationId);
        } finally {
            set({ sending: false });
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

/** Selector: returns "ProviderName — model" for the active provider. */
export function selectActiveProviderLabel(state: AiChatState): string {
    const { settings, providerCatalog } = state;
    if (!settings?.activeProvider) {
        return '';
    }
    const providerName = resolveProviderName(settings, providerCatalog) ?? '';
    const model = resolveActiveModel(settings) ?? '';
    return model ? `${providerName} — ${model}` : providerName;
}
