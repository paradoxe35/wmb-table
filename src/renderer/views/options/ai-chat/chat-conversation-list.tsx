import { Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { AiConversation } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

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

export default function ChatConversationList({
    conversations,
    activeConversationId,
    onCreateConversation,
    onSelectConversation,
    onDeleteConversation,
    onClearConversations,
}: {
    conversations: AiConversation[];
    activeConversationId: string | null;
    onCreateConversation: () => void;
    onSelectConversation: (conversationId: string) => void;
    onDeleteConversation: (conversationId: string) => void;
    onClearConversations: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                width: 220,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                borderInlineEnd: '1px solid var(--ant-color-border)',
                paddingInlineEnd: 12,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                }}
            >
                <Text strong style={{ fontSize: '0.9em' }}>
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

            <div style={{ flex: 1, overflow: 'auto' }}>
                {conversations.length === 0 ? (
                    <Text
                        type="secondary"
                        style={{ fontSize: '0.8em', display: 'block', padding: '12px 4px' }}
                    >
                        {t('Aucune conversation')}
                    </Text>
                ) : (
                    conversations.map((conversation) => {
                        const isActive = conversation.id === activeConversationId;
                        return (
                            <div
                                key={conversation.id}
                                role="button"
                                tabIndex={0}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: isActive
                                        ? 'var(--ant-color-primary-bg)'
                                        : 'transparent',
                                    marginBottom: 2,
                                    transition: 'background 0.15s',
                                }}
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
                                            fontSize: '0.82em',
                                            display: 'block',
                                            fontWeight: isActive ? 500 : 400,
                                        }}
                                    >
                                        {conversation.title || t('Conversation')}
                                    </Text>
                                    <Text
                                        type="secondary"
                                        style={{ fontSize: '0.7em', display: 'block' }}
                                    >
                                        {formatRelativeDate(conversation.updatedAt, t)}
                                    </Text>
                                </div>
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                                    style={{ opacity: 0.5, flexShrink: 0 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteConversation(conversation.id);
                                    }}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {conversations.length > 0 ? (
                <Popconfirm
                    title={t('Supprimer toutes les conversations ?')}
                    onConfirm={onClearConversations}
                >
                    <Button
                        size="small"
                        type="text"
                        danger
                        style={{ marginTop: 8, fontSize: '0.8em' }}
                    >
                        {t("Vider l'historique")}
                    </Button>
                </Popconfirm>
            ) : null}
        </div>
    );
}
