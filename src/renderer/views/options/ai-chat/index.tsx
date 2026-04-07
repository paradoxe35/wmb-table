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
    const createConversation = useAiChatStore((s) => s.createConversation);
    const selectConversation = useAiChatStore((s) => s.selectConversation);
    const deleteConversation = useAiChatStore((s) => s.deleteConversation);
    const clearConversations = useAiChatStore((s) => s.clearConversations);
    const sendMessage = useAiChatStore((s) => s.sendMessage);
    const stopGeneration = useAiChatStore((s) => s.stopGeneration);
    const streamingConversations = useAiChatStore((s) => s.streamingConversations);
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
    const activeSending = Boolean(
        activeConversationId && streamingConversations[activeConversationId],
    );

    const handleSend = useCallback(() => {
        const trimmed = draft.trim();
        if (!trimmed) {
            return;
        }
        void sendMessage(trimmed);
        setDraft('');
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
                streamingConversations={streamingConversations}
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

                <ChatMessageList messages={activeMessages} sending={activeSending} />

                <ChatInput
                    draft={draft}
                    sending={activeSending}
                    conversationId={activeConversationId}
                    completionCount={completionCount}
                    lastCompletedConversationId={lastCompletedConversationId}
                    onDraftChange={setDraft}
                    onSend={handleSend}
                    onStop={handleStop}
                />
            </div>
        </div>
    );
}
