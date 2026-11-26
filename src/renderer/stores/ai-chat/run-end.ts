import type {
    AiStreamCancelEvent,
    AiStreamCompleteEvent,
    AiStreamErrorEvent,
} from '@shared/ai.types';
import type { AiRunNotice, ChatRunState, ConversationRunState } from './chat-state';
import {
    isMessageEmpty,
    keepRecentMessages,
    removeConversationKey,
    removeReasoning,
    removeReasoningByMessageIds,
    updateRecentHistoryWindow,
} from './message-cache';

export type RunEnd =
    | { kind: 'complete'; event: AiStreamCompleteEvent }
    | { kind: 'cancel'; event: AiStreamCancelEvent }
    | { kind: 'error'; event: AiStreamErrorEvent };

export interface RunEndUpdate {
    state: Partial<ChatRunState>;
    shouldFlushQueue: boolean;
}

function noticeForRunEnd(
    end: RunEnd,
    run: ConversationRunState,
    answerIsEmpty: boolean,
    hasQueuedMessages: boolean,
): AiRunNotice | null {
    const messageId = end.event.messageId;

    switch (end.kind) {
        case 'error':
            return {
                kind: 'error',
                messageId,
                code: end.event.code ?? null,
                retryable: end.event.retryable ?? null,
                detail: end.event.error,
            };
        case 'cancel':
            return run.status === 'stopping' ? { kind: 'stopped', messageId } : null;
        case 'complete':
            if (answerIsEmpty) {
                return hasQueuedMessages ? null : { kind: 'empty', messageId };
            }
            if (end.event.outcome?.truncated) {
                return { kind: 'truncated', messageId };
            }
            if (end.event.outcome?.stepLimitReached) {
                return { kind: 'step-limit', messageId };
            }
            return null;
    }
}

/**
 * Closes the run a complete, cancel or error event belongs to. Events from an older run are
 * ignored (null). The open conversation keeps every loaded message; a conversation the user
 * left is trimmed back to the recent window to cap memory.
 */
export function applyRunEnd(state: ChatRunState, end: RunEnd): RunEndUpdate | null {
    const { conversationId, generationId, messageId } = end.event;
    const run = state.conversationRuns[conversationId];
    if (!run || run.generationId !== generationId) {
        return null;
    }

    const currentMessages = state.messagesByConversation[conversationId] ?? [];
    const answer = currentMessages.find((message) => message.id === messageId);
    const answerIsEmpty = isMessageEmpty(answer);
    const hasQueuedMessages = (state.queuedMessagesByConversation[conversationId] ?? []).length > 0;
    const keptMessages = answerIsEmpty
        ? currentMessages.filter((message) => message.id !== messageId)
        : currentMessages;
    const isOpen = state.activeConversationId === conversationId;
    const recent = isOpen
        ? { messages: keptMessages, removedMessageIds: [], wasTrimmed: false }
        : keepRecentMessages(keptMessages);
    const keepsReasoning = end.kind === 'complete' && !answerIsEmpty;
    const reasoningAfterTrim = removeReasoningByMessageIds(
        state.reasoningByMessage,
        recent.removedMessageIds,
    );
    const notice = noticeForRunEnd(end, run, answerIsEmpty, hasQueuedMessages);

    return {
        shouldFlushQueue: hasQueuedMessages,
        state: {
            conversationRuns: removeConversationKey(state.conversationRuns, conversationId),
            messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: recent.messages,
            },
            reasoningByMessage: keepsReasoning
                ? reasoningAfterTrim
                : removeReasoning(reasoningAfterTrim, messageId),
            historyByConversation: {
                ...state.historyByConversation,
                [conversationId]: updateRecentHistoryWindow(
                    state.historyByConversation[conversationId],
                    recent.messages.length,
                    recent.wasTrimmed,
                ),
            },
            runNoticeByConversation: notice
                ? { ...state.runNoticeByConversation, [conversationId]: notice }
                : removeConversationKey(state.runNoticeByConversation, conversationId),
            completionCount: state.completionCount + 1,
            lastCompletedConversationId: conversationId,
        },
    };
}
