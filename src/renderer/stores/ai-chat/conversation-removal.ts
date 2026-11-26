import type { ChatRunState } from './chat-state';
import type { ConversationListState, ConversationLookupState } from './conversation-list';
import {
    removeConversationKey,
    removeReasoningByMessageIds,
    type ConversationCacheState,
} from './message-cache';

type RemovableState = ChatRunState &
    ConversationCacheState &
    ConversationLookupState & { conversationList: ConversationListState };

function shrinkConversationList(
    list: ConversationListState,
    remainingCount: number,
): ConversationListState {
    const loadedCount = Math.max(list.loadedCount - 1, remainingCount);
    const totalCount = Math.max(list.totalCount - 1, 0);
    return { loadedCount, totalCount, hasMore: list.totalCount - 1 > loadedCount };
}

/** Forgets everything the renderer kept about a conversation main deleted. */
export function removeDeletedConversation(
    state: RemovableState,
    conversationId: string,
): Partial<RemovableState> {
    const remaining = state.conversations.filter(
        (conversation) => conversation.id !== conversationId,
    );
    const removedMessageIds = (state.messagesByConversation[conversationId] ?? []).map(
        (message) => message.id,
    );

    return {
        conversations: remaining,
        searchResults:
            state.searchResults?.filter((conversation) => conversation.id !== conversationId) ??
            null,
        conversationList: shrinkConversationList(state.conversationList, remaining.length),
        activeConversationId:
            state.activeConversationId === conversationId ? null : state.activeConversationId,
        activeConversationRecord:
            state.activeConversationRecord?.id === conversationId
                ? null
                : state.activeConversationRecord,
        messagesByConversation: removeConversationKey(state.messagesByConversation, conversationId),
        reasoningByMessage: removeReasoningByMessageIds(
            state.reasoningByMessage,
            removedMessageIds,
        ),
        loadingConversations: removeConversationKey(state.loadingConversations, conversationId),
        loadingOlderConversations: removeConversationKey(
            state.loadingOlderConversations,
            conversationId,
        ),
        historyByConversation: removeConversationKey(state.historyByConversation, conversationId),
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
}
