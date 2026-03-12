import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAiChatStore, useAppStore } from '@renderer/stores';
import ChatConversationList from './chat-conversation-list';
import ChatInput from './chat-input';
import ChatMessageList from './chat-message-list';

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
    const showOptions = useAppStore((s) => s.showOptions);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        void initialize();
    }, [initialize]);

    const activeMessages = useMemo(
        () => (activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []),
        [activeConversationId, messagesByConversation],
    );

    if (!settings) return null;

    if (!settings.enabled) {
        return (
            <Card>
                <Empty
                    image={<RobotOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />}
                    description={t("L'assistant IA est désactivé.")}
                >
                    <Button type="primary" onClick={() => showOptions('settings')}>
                        {t('Ouvrir les paramètres')}
                    </Button>
                </Empty>
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12 }}>
            <ChatConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onCreateConversation={() => void createConversation()}
                onSelectConversation={(id) => void selectConversation(id)}
                onDeleteConversation={(id) => void deleteConversation(id)}
                onClearConversations={() => void clearConversations()}
            />

            <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}
            >
                {error ? <Alert type="error" showIcon closable message={error} /> : null}

                <ChatMessageList messages={activeMessages} sending={sending} />

                <ChatInput
                    draft={draft}
                    sending={sending}
                    onDraftChange={setDraft}
                    onSend={() => {
                        void sendMessage(draft);
                        setDraft('');
                    }}
                    onStop={() => void stopGeneration()}
                />
            </div>
        </div>
    );
}
