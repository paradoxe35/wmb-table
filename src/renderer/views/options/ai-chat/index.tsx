import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import type { AiMessage } from '@shared/ai.types';
import ChatConversationList from './chat-conversation-list';
import ChatHeader from './chat-header';
import ChatInput from './chat-input';
import ChatMessageList from './chat-message-list';
import './ai-chat.scss';

const { Text } = Typography;
const EMPTY_MESSAGES: AiMessage[] = [];
const EMPTY_QUEUED_MESSAGES: { id: string; content: string }[] = [];

function DisabledState() {
    const { t } = useTranslation();
    const showOptions = useAppStore((s) => s.showOptions);

    return (
        <div className="ai-chat__disabled">
            <Empty
                image={
                    <RobotOutlined
                        style={{
                            fontSize: 'var(--fs-11xl)',
                            color: 'var(--ant-color-text-quaternary)',
                        }}
                    />
                }
                description={<Text type="secondary">{t("L'assistant IA est désactivé.")}</Text>}
            >
                <Button type="primary" onClick={() => showOptions('settings')}>
                    {t('Ouvrir les paramètres')}
                </Button>
            </Empty>
        </div>
    );
}

export default function AiChatView() {
    const { t } = useTranslation();
    const initialize = useAiChatStore((s) => s.initialize);
    const settings = useAiChatStore((s) => s.settings);
    const conversations = useAiChatStore((s) => s.conversations);
    const conversationList = useAiChatStore((s) => s.conversationList);
    const loadingConversationList = useAiChatStore((s) => s.loadingConversationList);
    const loadingOlderConversationList = useAiChatStore((s) => s.loadingOlderConversationList);
    const activeConversationId = useAiChatStore((s) => s.activeConversationId);
    const activeMessages = useAiChatStore((s) =>
        activeConversationId
            ? (s.messagesByConversation[activeConversationId] ?? EMPTY_MESSAGES)
            : EMPTY_MESSAGES,
    );
    const activeRun = useAiChatStore((s) =>
        activeConversationId ? (s.conversationRuns[activeConversationId] ?? null) : null,
    );
    const activeQueuedMessages = useAiChatStore((s) =>
        activeConversationId
            ? (s.queuedMessagesByConversation[activeConversationId] ?? EMPTY_QUEUED_MESSAGES)
            : EMPTY_QUEUED_MESSAGES,
    );
    const activeLoading = useAiChatStore((s) =>
        Boolean(activeConversationId && s.loadingConversations[activeConversationId]),
    );
    const activeLoadingOlder = useAiChatStore((s) =>
        Boolean(activeConversationId && s.loadingOlderConversations[activeConversationId]),
    );
    const activeHasMoreHistory = useAiChatStore((s) =>
        Boolean(activeConversationId && s.historyByConversation[activeConversationId]?.hasMore),
    );
    const conversationRuns = useAiChatStore((s) => s.conversationRuns);
    const createConversation = useAiChatStore((s) => s.createConversation);
    const loadOlderConversations = useAiChatStore((s) => s.loadOlderConversations);
    const selectConversation = useAiChatStore((s) => s.selectConversation);
    const loadOlderMessages = useAiChatStore((s) => s.loadOlderMessages);
    const renameConversation = useAiChatStore((s) => s.renameConversation);
    const deleteConversation = useAiChatStore((s) => s.deleteConversation);
    const exportConversationPdf = useAiChatStore((s) => s.exportConversationPdf);
    const clearConversations = useAiChatStore((s) => s.clearConversations);
    const sendMessage = useAiChatStore((s) => s.sendMessage);
    const stopGeneration = useAiChatStore((s) => s.stopGeneration);
    const removeQueuedMessage = useAiChatStore((s) => s.removeQueuedMessage);
    const error = useAiChatStore((s) => s.error);
    const completionCount = useAiChatStore((s) => s.completionCount);
    const lastCompletedConversationId = useAiChatStore((s) => s.lastCompletedConversationId);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        void initialize();
    }, [initialize]);
    const activeSending = Boolean(activeRun);
    const activeConversation = useMemo(
        () =>
            conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
        [activeConversationId, conversations],
    );
    const activeConversationMap = useMemo(
        () =>
            Object.fromEntries(
                Object.keys(conversationRuns).map((conversationId) => [conversationId, true]),
            ) as Readonly<Record<string, true>>,
        [conversationRuns],
    );
    const hasStreamingConversations = Object.keys(conversationRuns).length > 0;

    const handleSend = useCallback(() => {
        const trimmed = draft.trim();
        if (!trimmed) {
            return;
        }
        void sendMessage(trimmed).then((accepted) => {
            if (accepted) {
                setDraft('');
            }
        });
    }, [draft, sendMessage]);

    const handleCreateConversation = useCallback(() => {
        void createConversation();
    }, [createConversation]);

    const handleLoadOlderConversations = useCallback(() => {
        void loadOlderConversations();
    }, [loadOlderConversations]);

    const handleSelectConversation = useCallback(
        (id: string) => void selectConversation(id),
        [selectConversation],
    );

    const handleDeleteConversation = useCallback(
        (id: string) => void deleteConversation(id),
        [deleteConversation],
    );

    const handleRenameConversation = useCallback(
        (id: string, title: string) => renameConversation(id, title),
        [renameConversation],
    );

    const handleExportConversation = useCallback(
        (id: string) => exportConversationPdf(id),
        [exportConversationPdf],
    );

    const handleClearConversations = useCallback(() => {
        void clearConversations();
    }, [clearConversations]);

    const handleStop = useCallback(() => {
        void stopGeneration();
    }, [stopGeneration]);

    const handleQuickStart = useCallback(
        (prompt: string) => {
            void sendMessage(prompt);
        },
        [sendMessage],
    );

    const handleLoadOlderMessages = useCallback(() => {
        if (!activeConversationId) {
            return Promise.resolve();
        }

        return loadOlderMessages(activeConversationId);
    }, [activeConversationId, loadOlderMessages]);

    if (!settings) {
        return null;
    }

    if (!settings.enabled) {
        return <DisabledState />;
    }

    return (
        <div className="ai-chat">
            <ChatConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                streamingConversations={activeConversationMap}
                loading={loadingConversationList}
                loadingOlder={loadingOlderConversationList}
                hasMore={conversationList.hasMore}
                onCreateConversation={handleCreateConversation}
                onLoadOlderConversations={handleLoadOlderConversations}
                onSelectConversation={handleSelectConversation}
                onRenameConversation={handleRenameConversation}
                onExportConversation={handleExportConversation}
                onDeleteConversation={handleDeleteConversation}
                onClearConversations={handleClearConversations}
                hasStreamingConversations={hasStreamingConversations}
            />

            <div className="ai-chat__main">
                {activeConversation ? (
                    <ChatHeader
                        conversation={activeConversation}
                        isStreaming={activeSending}
                        onRenameConversation={handleRenameConversation}
                        onExportConversation={handleExportConversation}
                        onDeleteConversation={handleDeleteConversation}
                    />
                ) : null}

                {error ? (
                    <Alert
                        type="error"
                        showIcon
                        closable
                        message={t(error)}
                        style={{ margin: '12px 16px 0' }}
                    />
                ) : null}

                <ChatMessageList
                    conversationId={activeConversationId}
                    messages={activeMessages}
                    sending={activeSending}
                    activeAssistantMessageId={activeRun?.assistantMessageId ?? null}
                    hasQueuedMessages={activeQueuedMessages.length > 0}
                    queuedMessageCount={activeQueuedMessages.length}
                    loading={activeLoading}
                    loadingOlder={activeLoadingOlder}
                    hasMoreHistory={activeHasMoreHistory}
                    onLoadOlderMessages={handleLoadOlderMessages}
                    onQuickStart={handleQuickStart}
                />

                <ChatInput
                    draft={draft}
                    sending={activeSending}
                    runStatus={activeRun?.status ?? null}
                    queuedMessages={activeQueuedMessages}
                    conversationId={activeConversationId}
                    completionCount={completionCount}
                    lastCompletedConversationId={lastCompletedConversationId}
                    onDraftChange={setDraft}
                    onSend={handleSend}
                    onStop={handleStop}
                    onRemoveQueuedMessage={(queuedMessageId) => {
                        if (!activeConversationId) {
                            return;
                        }

                        removeQueuedMessage(activeConversationId, queuedMessageId);
                    }}
                />
            </div>
        </div>
    );
}
