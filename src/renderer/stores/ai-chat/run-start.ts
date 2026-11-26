import type { AiConversation, AiMessage } from '@shared/ai.types';
import type { ChatRunState } from './chat-state';
import { upsertConversation } from './conversation-list';
import { minimizeMessageForRenderer, removeConversationKey, upsertMessage } from './message-cache';

type RunStartState = ChatRunState & {
    conversations: AiConversation[];
    activeConversationRecord: AiConversation | null;
};

interface StartedRun {
    conversation: AiConversation;
    userMessages: AiMessage[];
    assistantMessage: AiMessage;
}

export interface RunStartedUpdate {
    state: Partial<RunStartState>;
    /** Stop was pressed before main confirmed the run, so it must be sent to the final id. */
    stopConversationId: string | null;
}

export function startRun(
    state: ChatRunState,
    conversationId: string,
    generationId: string,
): Partial<ChatRunState> {
    return {
        conversationRuns: {
            ...state.conversationRuns,
            [conversationId]: { generationId, assistantMessageId: null, status: 'starting' },
        },
        runNoticeByConversation: removeConversationKey(
            state.runNoticeByConversation,
            conversationId,
        ),
    };
}

/**
 * Applies main's answer to a send or retry. Main may move the run to another conversation id;
 * the view follows it only if the user is still on that conversation.
 */
export function applyRunStarted(
    state: RunStartState,
    conversationId: string,
    generationId: string,
    started: StartedRun,
): RunStartedUpdate {
    const resolvedConversationId = started.conversation.id;
    const existingMessages =
        state.messagesByConversation[resolvedConversationId] ??
        state.messagesByConversation[conversationId] ??
        [];
    const messagesWithUsers = started.userMessages.reduce(upsertMessage, existingMessages);
    const conversations = upsertConversation(state.conversations, started.conversation);
    const run = state.conversationRuns[conversationId];

    if (!run || run.generationId !== generationId) {
        return {
            stopConversationId: null,
            state: {
                conversations,
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [resolvedConversationId]: messagesWithUsers,
                },
            },
        };
    }

    const nextMessages = upsertMessage(
        messagesWithUsers,
        minimizeMessageForRenderer(started.assistantMessage),
    );
    const isStillOpen = state.activeConversationId === conversationId;
    const stopRequested = run.status === 'stopping';
    const conversationRuns = removeConversationKey(state.conversationRuns, conversationId);

    return {
        stopConversationId: stopRequested ? resolvedConversationId : null,
        state: {
            conversations,
            messagesByConversation: {
                ...state.messagesByConversation,
                [resolvedConversationId]: nextMessages,
            },
            historyByConversation: {
                ...state.historyByConversation,
                [resolvedConversationId]: {
                    loadedCount: nextMessages.length,
                    hasMore:
                        (
                            state.historyByConversation[resolvedConversationId] ??
                            state.historyByConversation[conversationId]
                        )?.hasMore ?? false,
                },
            },
            ...(isStillOpen
                ? {
                      activeConversationId: resolvedConversationId,
                      activeConversationRecord: started.conversation,
                  }
                : {}),
            conversationRuns: {
                ...conversationRuns,
                [resolvedConversationId]: {
                    ...run,
                    assistantMessageId: started.assistantMessage.id,
                    status: stopRequested ? 'stopping' : 'streaming',
                },
            },
        },
    };
}

/** Main refused to start the run: the conversation shows why. */
export function failRun(
    state: ChatRunState,
    conversationId: string,
    generationId: string,
    detail: string,
): Partial<ChatRunState> | null {
    const run = state.conversationRuns[conversationId];
    if (!run || run.generationId !== generationId) {
        return null;
    }

    return {
        conversationRuns: removeConversationKey(state.conversationRuns, conversationId),
        runNoticeByConversation: {
            ...state.runNoticeByConversation,
            [conversationId]: {
                kind: 'error',
                messageId: null,
                code: null,
                retryable: null,
                detail,
            },
        },
    };
}
