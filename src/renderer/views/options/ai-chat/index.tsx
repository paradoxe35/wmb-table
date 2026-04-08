import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import ChatConversationList from './chat-conversation-list';
import ChatInput from './chat-input';
import ChatMessageList from './chat-message-list';
import './ai-chat.css';

const { Text } = Typography;

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
    const activeConversationId = useAiChatStore((s) => s.activeConversationId);
    const messagesByConversation = useAiChatStore((s) => s.messagesByConversation);
    const loadingConversations = useAiChatStore((s) => s.loadingConversations);
    const conversationRuns = useAiChatStore((s) => s.conversationRuns);
    const queuedMessagesByConversation = useAiChatStore((s) => s.queuedMessagesByConversation);
    const createConversation = useAiChatStore((s) => s.createConversation);
    const selectConversation = useAiChatStore((s) => s.selectConversation);
    const deleteConversation = useAiChatStore((s) => s.deleteConversation);
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

    const activeMessages = useMemo(
        () => (activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []),
        [activeConversationId, messagesByConversation],
    );
    const activeRun = useMemo(
        () => (activeConversationId ? (conversationRuns[activeConversationId] ?? null) : null),
        [activeConversationId, conversationRuns],
    );
    const activeQueuedMessages = useMemo(
        () =>
            activeConversationId ? (queuedMessagesByConversation[activeConversationId] ?? []) : [],
        [activeConversationId, queuedMessagesByConversation],
    );
    const activeSending = Boolean(activeRun);
    const activeLoading = Boolean(
        activeConversationId && loadingConversations[activeConversationId],
    );
    const activeConversationMap = useMemo(
        () =>
            Object.fromEntries(
                Object.keys(conversationRuns).map((conversationId) => [conversationId, true]),
            ) as Readonly<Record<string, true>>,
        [conversationRuns],
    );

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

    const handleSelectConversation = useCallback(
        (id: string) => void selectConversation(id),
        [selectConversation],
    );

    const handleDeleteConversation = useCallback(
        (id: string) => void deleteConversation(id),
        [deleteConversation],
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
                queuedMessagesByConversation={queuedMessagesByConversation}
                onCreateConversation={handleCreateConversation}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
                onClearConversations={handleClearConversations}
            />

            <div className="ai-chat__main">
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
                    loading={activeLoading}
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
