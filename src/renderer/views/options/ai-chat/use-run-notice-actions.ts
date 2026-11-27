import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useAiChatStore } from '@renderer/stores/ai-chat.store';
import { findLastRetryableUserMessageId } from './message-retry';
import {
    CONTINUE_ANSWER_PROMPT,
    CONTINUE_RESEARCH_PROMPT,
    type RunNoticeAction,
} from './run-notice-copy';

/** Runs a banner button for the conversation the banner belongs to. */
export function useRunNoticeActions(conversationId: string): (action: RunNoticeAction) => void {
    const { t } = useTranslation();
    const sendMessage = useAiChatStore((s) => s.sendMessage);
    const retryLastUserMessage = useAiChatStore((s) => s.retryLastUserMessage);
    const flushQueuedMessages = useAiChatStore((s) => s.flushQueuedMessages);
    const openSettingsTab = useAppStore((s) => s.openSettingsTab);

    const retry = useCallback(() => {
        const state = useAiChatStore.getState();
        const refusedBeforeStart =
            state.runNoticeByConversation[conversationId]?.messageId === null;
        if (refusedBeforeStart && state.queuedMessagesByConversation[conversationId]?.length) {
            void flushQueuedMessages(conversationId);
            return;
        }

        const messages = state.messagesByConversation[conversationId] ?? [];
        const userMessageId = findLastRetryableUserMessageId(messages);
        // Main only reruns a question with no answer text yet; a cut answer resumes
        void (userMessageId
            ? retryLastUserMessage(conversationId, userMessageId)
            : sendMessage(t(CONTINUE_ANSWER_PROMPT)));
    }, [conversationId, flushQueuedMessages, retryLastUserMessage, sendMessage, t]);

    return useCallback(
        (action: RunNoticeAction) => {
            switch (action) {
                case 'continue':
                    void sendMessage(t(CONTINUE_ANSWER_PROMPT));
                    return;
                case 'continue-research':
                    void sendMessage(t(CONTINUE_RESEARCH_PROMPT));
                    return;
                case 'open-settings':
                    openSettingsTab('ai');
                    return;
                case 'retry':
                    retry();
            }
        },
        [openSettingsTab, retry, sendMessage, t],
    );
}
