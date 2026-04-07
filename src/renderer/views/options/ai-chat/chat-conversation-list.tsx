import { memo } from 'react';
import { Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import type { AiConversation } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

const { Text } = Typography;
type StreamingConversationMap = Readonly<Record<string, true>>;

function formatRelativeDate(isoDate: string, t: (key: string) => string): string {
    const now = Date.now();
    const date = new Date(isoDate).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t('maintenant');
    if (diffMin < 60) return `${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}j`;
    return new Date(isoDate).toLocaleDateString();
}

export default memo(function ChatConversationList({
    conversations,
    activeConversationId,
    streamingConversations,
    onCreateConversation,
    onSelectConversation,
    onDeleteConversation,
    onClearConversations,
}: {
    conversations: AiConversation[];
    activeConversationId: string | null;
    streamingConversations: StreamingConversationMap;
    onCreateConversation: () => void;
    onSelectConversation: (conversationId: string) => void;
    onDeleteConversation: (conversationId: string) => void;
    onClearConversations: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="ai-chat__sidebar">
            <div className="ai-chat__sidebar-header">
                <Text strong style={{ fontSize: 'var(--fs-rel-xl)' }}>
                    {t('Conversations')}
                </Text>
                <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={onCreateConversation}
                    title={t('Nouveau')}
                />
            </div>

            <div className="ai-chat__sidebar-list">
                {conversations.length === 0 ? (
                    <Text
                        type="secondary"
                        style={{
                            fontSize: 'var(--fs-rel-base)',
                            display: 'block',
                            padding: '16px 10px',
                        }}
                    >
                        {t('Aucune conversation')}
                    </Text>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {conversations.map((conversation) => {
                            const isActive = conversation.id === activeConversationId;
                            const isStreaming = Boolean(streamingConversations[conversation.id]);
                            const showStreamingStatus = isStreaming && !isActive;
                            return (
                                <motion.div
                                    key={conversation.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    role="button"
                                    tabIndex={0}
                                    title={conversation.title || undefined}
                                    className={`ai-chat__conv-item ${isActive ? 'ai-chat__conv-item--active' : ''}`}
                                    onClick={() => onSelectConversation(conversation.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            onSelectConversation(conversation.id);
                                        }
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                            ellipsis
                                            style={{
                                                fontSize: 'var(--fs-rel-lg)',
                                                display: 'block',
                                                fontWeight: isActive ? 500 : 400,
                                            }}
                                        >
                                            {conversation.title || t('Conversation')}
                                        </Text>
                                        <Text
                                            type="secondary"
                                            style={{
                                                fontSize: 'var(--fs-rel-xs)',
                                                display: 'block',
                                            }}
                                        >
                                            {formatRelativeDate(conversation.updatedAt, t)}
                                        </Text>
                                    </div>
                                    <div className="ai-chat__conv-action">
                                        {showStreamingStatus ? (
                                            <span
                                                className="ai-chat__conv-status"
                                                title={t('Génération en cours')}
                                                aria-label={t('Génération en cours')}
                                            >
                                                <LoadingOutlined spin />
                                            </span>
                                        ) : (
                                            <Popconfirm
                                                title={t('Supprimer cette conversation ?')}
                                                disabled={isStreaming}
                                                onConfirm={(e) => {
                                                    e?.stopPropagation();
                                                    onDeleteConversation(conversation.id);
                                                }}
                                                onCancel={(e) => e?.stopPropagation()}
                                            >
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    disabled={isStreaming}
                                                    className="ai-chat__conv-delete"
                                                    icon={
                                                        <DeleteOutlined
                                                            style={{ fontSize: 'var(--fs-xs)' }}
                                                        />
                                                    }
                                                    style={{ flexShrink: 0 }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </Popconfirm>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {conversations.length > 0 ? (
                <div className="ai-chat__sidebar-footer">
                    <Popconfirm
                        title={t('Supprimer toutes les conversations ?')}
                        onConfirm={onClearConversations}
                    >
                        <Button
                            size="small"
                            type="text"
                            danger
                            block
                            style={{ fontSize: 'var(--fs-rel-base)' }}
                        >
                            {t("Vider l'historique")}
                        </Button>
                    </Popconfirm>
                </div>
            ) : null}
        </div>
    );
});
