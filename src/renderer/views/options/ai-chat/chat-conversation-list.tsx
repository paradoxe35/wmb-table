import { memo, useCallback, useMemo, useRef } from 'react';
import type { MenuProps } from 'antd';
import { App as AntApp, Button, Dropdown, Input, Popconfirm, Typography, message } from 'antd';
import { LoadingOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { AiConversation } from '@shared/ai.types';
import type { PdfExportResult } from '@shared/ipc.types';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import RelativeTime from '@renderer/components/relative-time';

const { Text } = Typography;
type StreamingConversationMap = Readonly<Record<string, true>>;

const ConversationListItem = memo(function ConversationListItem({
    conversation,
    isActive,
    isStreaming,
    onSelectConversation,
    onRenameConversation,
    onExportConversation,
    onDeleteConversation,
}: {
    conversation: AiConversation;
    isActive: boolean;
    isStreaming: boolean;
    onSelectConversation: (conversationId: string) => void;
    onRenameConversation: (conversationId: string, title: string) => Promise<AiConversation>;
    onExportConversation: (conversationId: string) => Promise<PdfExportResult>;
    onDeleteConversation: (conversationId: string) => void;
}) {
    const { t } = useTranslation();
    const { modal } = AntApp.useApp();
    const showStreamingStatus = isStreaming && !isActive;

    const openRenameModal = useCallback(() => {
        let nextTitle = conversation.title ?? '';

        const save = async () => {
            const trimmedTitle = nextTitle.trim();
            if (!trimmedTitle) {
                message.error(t('Le nom entré est invalid'));
                throw new Error('invalid-title');
            }

            try {
                await onRenameConversation(conversation.id, trimmedTitle);
                message.success(t('Modifié'));
            } catch (error) {
                const errorMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : 'Conversation introuvable.';
                message.error(t(errorMessage));
                throw error;
            }
        };

        const modalInstance = modal.info({
            closable: true,
            icon: null,
            title: t('Renommer'),
            okText: t('Enregistrer'),
            content: (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save()
                            .then(() => modalInstance.destroy())
                            .catch(() => {});
                    }}
                >
                    <Input
                        autoFocus
                        size="large"
                        defaultValue={conversation.title ?? ''}
                        allowClear
                        onChange={(event) => {
                            nextTitle = event.currentTarget.value;
                        }}
                        placeholder={t('Nom de la conversation')}
                    />
                </form>
            ),
            onOk: save,
        });
    }, [conversation.id, conversation.title, modal, onRenameConversation, t]);

    const confirmDelete = useCallback(() => {
        modal.confirm({
            title: t('Supprimer cette conversation ?'),
            okText: t('Oui'),
            cancelText: t('Non'),
            onOk: () => onDeleteConversation(conversation.id),
        });
    }, [conversation.id, modal, onDeleteConversation, t]);

    const handleExport = useCallback(async () => {
        try {
            const result = await onExportConversation(conversation.id);
            if (result.status === 'success') {
                message.success(t('PDF exporté avec succès'));
            } else if (result.status === 'empty') {
                message.warning(t('Cette conversation est vide.'));
            }
        } catch {
            message.error(t("Erreur lors de l'export PDF"));
        }
    }, [conversation.id, onExportConversation, t]);

    const menuItems = useMemo<MenuProps['items']>(
        () => [
            {
                key: 'export-pdf',
                label: t('Exporter en PDF'),
                disabled: isStreaming,
                onClick: () => {
                    void handleExport();
                },
            },
            {
                key: 'rename',
                label: t('Renommer'),
                disabled: isStreaming,
                onClick: openRenameModal,
            },
            {
                key: 'delete',
                label: t('Supprimer'),
                danger: true,
                disabled: isStreaming,
                onClick: confirmDelete,
            },
        ],
        [confirmDelete, handleExport, isStreaming, openRenameModal, t],
    );

    return (
        <motion.div
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
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectConversation(conversation.id);
                }
            }}
        >
            <div className="ai-chat__conv-body">
                <Text
                    ellipsis
                    className="ai-chat__conv-title"
                    style={{ fontWeight: isActive ? 500 : 400 }}
                >
                    {conversation.title || t('Conversation')}
                </Text>
                <Text type="secondary" className="ai-chat__conv-date">
                    <RelativeTime date={conversation.updatedAt} />
                </Text>
            </div>
            <div
                className={`ai-chat__conv-action ${showStreamingStatus ? 'ai-chat__conv-action--visible' : ''}`}
            >
                {showStreamingStatus ? (
                    <span
                        className="ai-chat__conv-status"
                        title={t('Génération en cours')}
                        aria-label={t('Génération en cours')}
                    >
                        <LoadingOutlined spin />
                    </span>
                ) : (
                    <span
                        className="ai-chat__conv-menu-wrap"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <Button
                                type="text"
                                size="small"
                                disabled={isStreaming}
                                className="ai-chat__conv-menu-trigger"
                                icon={<MoreOutlined style={{ fontSize: 'var(--fs-xs)' }} />}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                            />
                        </Dropdown>
                    </span>
                )}
            </div>
        </motion.div>
    );
});

export default memo(function ChatConversationList({
    conversations,
    activeConversationId,
    streamingConversations,
    loading,
    loadingOlder,
    hasMore,
    onCreateConversation,
    onLoadOlderConversations,
    onSelectConversation,
    onRenameConversation,
    onExportConversation,
    onDeleteConversation,
    onClearConversations,
}: {
    conversations: AiConversation[];
    activeConversationId: string | null;
    streamingConversations: StreamingConversationMap;
    loading: boolean;
    loadingOlder: boolean;
    hasMore: boolean;
    onCreateConversation: () => void;
    onLoadOlderConversations: () => void;
    onSelectConversation: (conversationId: string) => void;
    onRenameConversation: (conversationId: string, title: string) => Promise<AiConversation>;
    onExportConversation: (conversationId: string) => Promise<PdfExportResult>;
    onDeleteConversation: (conversationId: string) => void;
    onClearConversations: () => void;
}) {
    const { t } = useTranslation();
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container || loading || loadingOlder || !hasMore) {
            return;
        }

        const remaining = container.scrollHeight - (container.scrollTop + container.clientHeight);
        if (remaining <= 48) {
            onLoadOlderConversations();
        }
    }, [hasMore, loading, loadingOlder, onLoadOlderConversations]);

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

            <div className="ai-chat__sidebar-list" ref={scrollRef} onScroll={handleScroll}>
                {conversations.length === 0 && !loading ? (
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
                    <>
                        <AnimatePresence mode="popLayout">
                            {conversations.map((conversation) => (
                                <ConversationListItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    isActive={conversation.id === activeConversationId}
                                    isStreaming={Boolean(streamingConversations[conversation.id])}
                                    onSelectConversation={onSelectConversation}
                                    onRenameConversation={onRenameConversation}
                                    onExportConversation={onExportConversation}
                                    onDeleteConversation={onDeleteConversation}
                                />
                            ))}
                        </AnimatePresence>
                        {loading || loadingOlder ? (
                            <div className="ai-chat__sidebar-loading">
                                <LoadingOutlined spin />
                            </div>
                        ) : null}
                    </>
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
