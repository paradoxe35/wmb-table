import type { AiConversation, AiConversationHistoryPage } from '@shared/ai.types';

export interface ConversationListState {
    loadedCount: number;
    totalCount: number;
    hasMore: boolean;
}

export interface ConversationLookupState {
    conversations: AiConversation[];
    searchResults: AiConversation[] | null;
    activeConversationRecord: AiConversation | null;
}

export const EMPTY_CONVERSATION_LIST: ConversationListState = {
    loadedCount: 0,
    totalCount: 0,
    hasMore: false,
};

export function createConversationListState(
    page: AiConversationHistoryPage,
): ConversationListState {
    return {
        loadedCount: page.loadedCount,
        totalCount: page.totalCount,
        hasMore: page.hasMore,
    };
}

function updatedAtTime(conversation: AiConversation): number {
    return new Date(conversation.updatedAt).getTime();
}

export function sortConversationsByUpdatedAt(conversations: AiConversation[]): AiConversation[] {
    return [...conversations].sort((left, right) => updatedAtTime(right) - updatedAtTime(left));
}

export function upsertConversation(
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

export function mergeFetchedConversations(
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

function belongsInLoadedWindow(
    conversations: AiConversation[],
    list: ConversationListState,
    conversation: AiConversation,
): boolean {
    if (conversations.some((item) => item.id === conversation.id)) {
        return true;
    }

    const oldestLoaded = conversations[conversations.length - 1];
    return (
        !list.hasMore || !oldestLoaded || updatedAtTime(conversation) >= updatedAtTime(oldestLoaded)
    );
}

/**
 * Applies a conversation main changed (an AI title, for example). The paged counts stay as they
 * are: they mirror database offsets, and a conversation outside the window must not shift them.
 */
export function applyConversationUpdate(
    state: ConversationLookupState & { conversationList: ConversationListState },
    conversation: AiConversation,
): Partial<ConversationLookupState> {
    return {
        conversations: belongsInLoadedWindow(
            state.conversations,
            state.conversationList,
            conversation,
        )
            ? upsertConversation(state.conversations, conversation)
            : state.conversations,
        searchResults:
            state.searchResults?.map((item) =>
                item.id === conversation.id ? conversation : item,
            ) ?? null,
        activeConversationRecord:
            state.activeConversationRecord?.id === conversation.id
                ? conversation
                : state.activeConversationRecord,
    };
}

/**
 * A conversation opened from search may sit outside the paged window. Looking it
 * up here keeps `conversations` a faithful view of that window instead of a
 * general lookup table.
 */
export function findKnownConversation(
    state: ConversationLookupState,
    conversationId: string,
): AiConversation | null {
    return (
        state.conversations.find((conversation) => conversation.id === conversationId) ??
        state.searchResults?.find((conversation) => conversation.id === conversationId) ??
        (state.activeConversationRecord?.id === conversationId
            ? state.activeConversationRecord
            : null)
    );
}

export function resolvePersistedActiveConversationId(
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

/** After the list reloads, a conversation the user still has open stays selected. */
export function keepOpenConversation(
    state: ConversationLookupState & { activeConversationId: string | null },
    reloaded: AiConversation[],
): { activeConversationId: string | null; activeConversationRecord: AiConversation | null } {
    const openId = state.activeConversationId;
    const openRecord = openId ? findKnownConversation(state, openId) : null;
    return {
        activeConversationId: openRecord
            ? openId
            : resolvePersistedActiveConversationId(reloaded, openId),
        activeConversationRecord: openRecord,
    };
}
