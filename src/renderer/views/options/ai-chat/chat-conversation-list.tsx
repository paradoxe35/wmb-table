import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Input, Popconfirm, Tooltip, Typography } from 'antd';
import { LoadingOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { AiConversation } from '@shared/ai.types';
import type { PdfExportResult } from '@shared/ipc.types';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import RelativeTime from '@renderer/components/relative-time';
import {
    useConversationActions,
    type ConversationActionCallbacks,
} from './use-conversation-actions';

const { Text } = Typography;
type StreamingConversationMap = Readonly<Record<string, true>>;

interface ConversationListItemProps extends ConversationActionCallbacks {
    conversation: AiConversation;
    isActive: boolean;
    isStreaming: boolean;
    onSelectConversation: (conversationId: string) => void;
}

const ConversationListItem = memo(function ConversationListItem({
    conversation,
    isActive,
    isStreaming,
    onSelectConversation,
    ...callbacks
}: ConversationListItemProps) {
    const { t } = useTranslation();
    const showStreamingStatus = isStreaming && !isActive;
    const { openRenameModal, confirmDelete, handleExport } = useConversationActions(
        conversation,
        callbacks,
    );

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
    hasStreamingConversations,
    searchTerm,
    isSearching,
    onSearchChange,
}: {
    conversations: AiConversation[];
    activeConversationId: string | null;
    streamingConversations: StreamingConversationMap;
    loading: boolean;
    loadingOlder: boolean;
    hasMore: boolean;
    searchTerm: string;
    isSearching: boolean;
    onSearchChange: (term: string) => void;
    onCreateConversation: () => void;
    onLoadOlderConversations: () => void;
    onSelectConversation: (conversationId: string) => void;
    onRenameConversation: (conversationId: string, title: string) => Promise<AiConversation>;
    onExportConversation: (conversationId: string) => Promise<PdfExportResult>;
    onDeleteConversation: (conversationId: string) => void;
    onClearConversations: () => void;
    hasStreamingConversations: boolean;
}) {
    const { t } = useTranslation();
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [draftSearch, setDraftSearch] = useState(searchTerm);

    // Debounce so typing doesn't fire a query per keystroke
    useEffect(() => {
        if (draftSearch === searchTerm) {
            return;
        }

        const timer = window.setTimeout(() => onSearchChange(draftSearch), 250);
        return () => window.clearTimeout(timer);
    }, [draftSearch, onSearchChange, searchTerm]);

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
                <Tooltip title={t('Nouvelle conversation')}>
                    <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined />}
                        className="ai-chat__new-conversation"
                        onClick={onCreateConversation}
                        aria-label={t('Nouvelle conversation')}
                    />
                </Tooltip>
            </div>

            <div className="ai-chat__sidebar-search">
                <Input
                    allowClear
                    size="small"
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />}
                    suffix={isSearching && loading ? <LoadingOutlined spin /> : null}
                    placeholder={t('Rechercher une conversation')}
                    aria-label={t('Rechercher une conversation')}
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
                        {isSearching ? t('Aucun résultat') : t('Aucune conversation')}
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

            {conversations.length > 0 && !isSearching ? (
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
                            disabled={hasStreamingConversations}
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
