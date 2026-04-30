import { memo } from 'react';
import { Button, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, FilePdfOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AiConversation } from '@shared/ai.types';
import {
    useConversationActions,
    type ConversationActionCallbacks,
} from './use-conversation-actions';

interface ChatHeaderProps extends ConversationActionCallbacks {
    conversation: AiConversation;
    isStreaming: boolean;
}

const ChatHeader = memo(function ChatHeader({
    conversation,
    isStreaming,
    ...callbacks
}: ChatHeaderProps) {
    const { t } = useTranslation();
    const { openRenameModal, confirmDelete, handleExport } = useConversationActions(
        conversation,
        callbacks,
    );
    const title = conversation.title || t('Conversation');

    return (
        <header className="ai-chat__header">
            <div
                className="ai-chat__header-side ai-chat__header-side--left ai-chat__header-side--placeholder"
                aria-hidden
            />

            <div className="ai-chat__header-title">
                {isStreaming && (
                    <LoadingOutlined
                        spin
                        className="ai-chat__header-streaming"
                        aria-label={t('Génération en cours')}
                    />
                )}
                <span className="ai-chat__header-title-text" title={title}>
                    {title}
                </span>
            </div>

            <div className="ai-chat__header-side ai-chat__header-side--right">
                <Tooltip title={t('Renommer')}>
                    <Button
                        type="text"
                        size="small"
                        shape="circle"
                        icon={<EditOutlined />}
                        disabled={isStreaming}
                        aria-label={t('Renommer')}
                        onClick={openRenameModal}
                    />
                </Tooltip>
                <Tooltip title={t('Exporter en PDF')}>
                    <Button
                        type="text"
                        size="small"
                        shape="circle"
                        icon={<FilePdfOutlined />}
                        disabled={isStreaming}
                        aria-label={t('Exporter en PDF')}
                        onClick={() => void handleExport()}
                    />
                </Tooltip>
                <Tooltip title={t('Supprimer')}>
                    <Button
                        type="text"
                        size="small"
                        shape="circle"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={isStreaming}
                        aria-label={t('Supprimer')}
                        onClick={confirmDelete}
                    />
                </Tooltip>
            </div>
        </header>
    );
});

export default ChatHeader;
