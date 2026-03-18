import { useEffect, useMemo, useState } from 'react';
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
    const sending = useAiChatStore((s) => s.sending);
    const error = useAiChatStore((s) => s.error);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        void initialize();
    }, [initialize]);

    const activeMessages = useMemo(
        () => (activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []),
        [activeConversationId, messagesByConversation],
    );

    if (!settings) {
        return null;
    }

    if (!settings.enabled) {
        return <DisabledState />;
    }

    function handleSend() {
        if (!draft.trim()) {
            return;
        }
        void sendMessage(draft);
        setDraft('');
    }

    return (
        <div className="ai-chat">
            <ChatConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onCreateConversation={() => void createConversation()}
                onSelectConversation={(id) => void selectConversation(id)}
                onDeleteConversation={(id) => void deleteConversation(id)}
                onClearConversations={() => void clearConversations()}
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

                <ChatMessageList messages={activeMessages} sending={sending} />

                <ChatInput
                    draft={draft}
                    sending={sending}
                    onDraftChange={setDraft}
                    onSend={handleSend}
                    onStop={() => void stopGeneration()}
                />
            </div>
        </div>
    );
}
