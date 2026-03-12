import { Button, List, Popconfirm, Typography } from 'antd';
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
                width: 240,
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
                <Text strong>{t('Conversations')}</Text>
                <Button size="small" icon={<PlusOutlined />} onClick={onCreateConversation}>
                    {t('Nouveau')}
                </Button>
            </div>

            <List
                style={{ flex: 1, overflow: 'auto' }}
                dataSource={conversations}
                locale={{ emptyText: t('Aucune conversation') }}
                renderItem={(conversation) => (
                    <List.Item
                        style={{
                            cursor: 'pointer',
                            background:
                                conversation.id === activeConversationId
                                    ? 'var(--ant-color-primary-bg)'
                                    : 'transparent',
                            borderRadius: 8,
                            paddingInline: 8,
                            paddingBlock: 6,
                        }}
                        onClick={() => onSelectConversation(conversation.id)}
                        actions={[
                            <Button
                                key="delete"
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteConversation(conversation.id);
                                }}
                            />,
                        ]}
                    >
                        <List.Item.Meta
                            title={
                                <Text ellipsis style={{ fontSize: '0.85em', maxWidth: 140 }}>
                                    {conversation.title || t('Conversation')}
                                </Text>
                            }
                            description={
                                <Text type="secondary" style={{ fontSize: '0.75em' }}>
                                    {formatRelativeDate(conversation.updatedAt, t)}
                                </Text>
                            }
                        />
                    </List.Item>
                )}
            />

            {conversations.length > 0 ? (
                <Popconfirm
                    title={t('Supprimer toutes les conversations ?')}
                    onConfirm={onClearConversations}
                >
                    <Button size="small" danger style={{ marginTop: 8 }}>
                        {t("Vider l'historique")}
                    </Button>
                </Popconfirm>
            ) : null}
        </div>
    );
}
