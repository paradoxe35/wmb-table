import type { AiMessage, AiMessageHistoryPage } from '@shared/ai.types';
import { AI_MESSAGE_HISTORY_PAGE_SIZE } from '@shared/ai.types';
import type {
    ChatRunState,
    ConversationHistoryMap,
    ConversationHistoryState,
    LoadingConversationMap,
    MessageMap,
    ReasoningMap,
} from './chat-state';

export function removeConversationKey<T>(
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

export function createConversationHistoryState(
    page: AiMessageHistoryPage,
): ConversationHistoryState {
    return {
        loadedCount: page.loadedCount,
        hasMore: page.hasMore,
    };
}

export function upsertMessage(messages: AiMessage[], message: AiMessage): AiMessage[] {
    const existing = messages.findIndex((item) => item.id === message.id);
    if (existing === -1) {
        return [...messages, message];
    }

    return messages.map((item, index) => (index === existing ? message : item));
}

export function updateConversationMessages(
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

export function mergeFetchedMessages(existing: AiMessage[], fetched: AiMessage[]): AiMessage[] {
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

export function keepRecentMessages(
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

export function updateRecentHistoryWindow(
    history: ConversationHistoryState | undefined,
    messageCount: number,
    wasTrimmed: boolean,
): ConversationHistoryState {
    return {
        loadedCount: messageCount,
        hasMore: Boolean(history?.hasMore || wasTrimmed),
    };
}

export function minimizeMessageForRenderer(message: AiMessage): AiMessage {
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

export function minimizeMessagesForRenderer(messages: AiMessage[]): AiMessage[] {
    return messages.map(minimizeMessageForRenderer);
}

export function removeReasoning(reasoningByMessage: ReasoningMap, messageId: string): ReasoningMap {
    if (!(messageId in reasoningByMessage)) {
        return reasoningByMessage;
    }

    const next = { ...reasoningByMessage };
    delete next[messageId];
    return next;
}

export function removeReasoningByMessageIds(
    reasoningByMessage: ReasoningMap,
    messageIds: Iterable<string>,
): ReasoningMap {
    let next = reasoningByMessage;
    for (const messageId of messageIds) {
        next = removeReasoning(next, messageId);
    }
    return next;
}

export function isMessageEmpty(message: AiMessage | undefined): boolean {
    if (!message) {
        return true;
    }

    return (
        !message.content.trim() &&
        message.toolCalls.length === 0 &&
        message.toolResults.length === 0
    );
}

export interface ConversationCacheState {
    messagesByConversation: MessageMap;
    reasoningByMessage: ReasoningMap;
    loadingConversations: LoadingConversationMap;
    loadingOlderConversations: LoadingConversationMap;
    historyByConversation: ConversationHistoryMap;
}

/** Drops cached messages of conversations that are neither open, running nor queued. */
export function pruneConversationCache(
    state: ConversationCacheState &
        Pick<ChatRunState, 'conversationRuns' | 'queuedMessagesByConversation'>,
    activeConversationId: string | null,
): ConversationCacheState {
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
