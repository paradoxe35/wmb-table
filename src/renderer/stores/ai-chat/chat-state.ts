import type { AiErrorCode, AiMessage } from '@shared/ai.types';

export type MessageMap = Record<string, AiMessage[]>;
export type ReasoningMap = Record<string, string>;
export type LoadingConversationMap = Record<string, true>;

export interface ConversationHistoryState {
    loadedCount: number;
    hasMore: boolean;
}

export type ConversationHistoryMap = Record<string, ConversationHistoryState>;

/** `stopping` also marks a Stop pressed before main confirmed the run. */
export type ConversationRunStatus = 'starting' | 'streaming' | 'stopping';

export interface ConversationRunState {
    generationId: string;
    assistantMessageId: string | null;
    status: ConversationRunStatus;
}

export type ConversationRunMap = Record<string, ConversationRunState>;

export interface QueuedMessage {
    id: string;
    content: string;
    createdAt: string;
}

export type QueuedMessageMap = Record<string, QueuedMessage[]>;

export type AiRunNoticeKind = 'truncated' | 'step-limit' | 'stopped' | 'empty';

/** How the last run of a conversation ended, when the user needs to know. */
export type AiRunNotice =
    | { kind: AiRunNoticeKind; messageId: string }
    | {
          kind: 'error';
          messageId: string | null;
          code: AiErrorCode | null;
          retryable: boolean | null;
          detail: string;
      };

export type RunNoticeMap = Record<string, AiRunNotice>;

export interface ChatRunState {
    activeConversationId: string | null;
    messagesByConversation: MessageMap;
    reasoningByMessage: ReasoningMap;
    historyByConversation: ConversationHistoryMap;
    conversationRuns: ConversationRunMap;
    queuedMessagesByConversation: QueuedMessageMap;
    runNoticeByConversation: RunNoticeMap;
    completionCount: number;
    lastCompletedConversationId: string | null;
}
