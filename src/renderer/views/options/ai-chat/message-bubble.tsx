import { memo, useMemo, useState } from 'react';
import { Button, Spin, Tooltip, Typography } from 'antd';
import {
    BulbOutlined,
    LoadingOutlined,
    ReloadOutlined,
    RobotOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import { useAiChatStore, selectActiveProviderLabel } from '@renderer/stores/ai-chat.store';
import type { AiRunNotice } from '@renderer/stores/ai-chat/chat-state';
import ChatToolResult from './chat-tool-result';
import ChatRunNotice from './chat-run-notice';
import { groupToolResults } from './tool-results';
import AssistantMarkdown from './assistant-markdown';
import SelectableMessageContent from './selectable-message-content';

const { Text } = Typography;
const MAX_REASONING_LINES = 50;

function ReasoningBlock({ messageId }: { messageId: string }) {
    const { t } = useTranslation();
    const reasoning = useAiChatStore((s) => s.reasoningByMessage[messageId]);
    const [collapsed, setCollapsed] = useState(true);

    if (!reasoning) {
        return null;
    }

    const lines = reasoning.split('\n');
    const truncated = lines.slice(-MAX_REASONING_LINES).join('\n');
    const wasTruncated = lines.length > MAX_REASONING_LINES;

    return (
        <div className="ai-reasoning">
            <div className="ai-reasoning__toggle" onClick={() => setCollapsed((c) => !c)}>
                <BulbOutlined />
                <Text type="secondary" style={{ fontSize: 'var(--fs-rel-lg)' }}>
                    {collapsed ? t('Voir le raisonnement') : t('Masquer le raisonnement')}
                </Text>
            </div>
            {!collapsed && (
                <div className="ai-reasoning__content">
                    {wasTruncated && (
                        <Text
                            type="secondary"
                            style={{
                                fontSize: 'var(--fs-rel-md)',
                                display: 'block',
                                marginBottom: 4,
                            }}
                        >
                            ({t('{{count}} dernières lignes', { count: MAX_REASONING_LINES })})
                        </Text>
                    )}
                    <pre>{truncated}</pre>
                </div>
            )}
        </div>
    );
}

const VISIBLE_TOOL_RESULTS = 3;

function ToolResultsList({ results }: { results: AiToolResult[] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const grouped = useMemo(() => groupToolResults([...results].reverse()), [results]);
    const shouldCollapse = grouped.length > VISIBLE_TOOL_RESULTS;
    const visible = shouldCollapse && !expanded ? grouped.slice(0, VISIBLE_TOOL_RESULTS) : grouped;
    const hiddenCount = grouped.length - VISIBLE_TOOL_RESULTS;

    return (
        <div className="ai-chat__tool-results">
            {visible.map((g) => (
                <ChatToolResult
                    key={g.name}
                    name={g.name}
                    count={g.count}
                    incomplete={g.incomplete}
                />
            ))}
            {shouldCollapse && (
                <button
                    type="button"
                    className="ai-chat__tool-results-more"
                    onClick={() => setExpanded((e) => !e)}
                >
                    {expanded
                        ? t('Voir moins')
                        : t(hiddenCount === 1 ? '+{{count}} autre' : '+{{count}} autres', {
                              count: hiddenCount,
                          })}
                </button>
            )}
        </div>
    );
}

export const MessageBubble = memo(function MessageBubble({
    conversationId,
    message,
    isActive,
    retryUserMessageId,
    notice,
}: {
    conversationId: string | null;
    message: AiMessage;
    isActive: boolean;
    retryUserMessageId: string | null;
    notice: AiRunNotice | null;
}) {
    const { t } = useTranslation();
    const isUser = message.role === 'user';
    const isEmptyAssistant = !isUser && !isActive && !message.content.trim();
    const providerLabel = useAiChatStore(selectActiveProviderLabel);
    const retryLastUserMessage = useAiChatStore((s) => s.retryLastUserMessage);
    const providerTooltip = isUser ? '' : providerLabel;

    if (isEmptyAssistant && !retryUserMessageId) {
        return null;
    }

    const isWaiting = isActive && !message.content;

    const avatarClass = [
        'ai-chat__avatar',
        `ai-chat__avatar--${isUser ? 'user' : 'assistant'}`,
        isActive ? 'ai-chat__avatar--active' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`ai-chat__bubble ai-chat__bubble--${isUser ? 'user' : 'assistant'}`}
        >
            <Tooltip title={providerTooltip} placement="top">
                <div className={avatarClass}>{isUser ? <UserOutlined /> : <RobotOutlined />}</div>
            </Tooltip>

            <SelectableMessageContent
                className={`ai-chat__bubble-content ai-chat__bubble-content--${isUser ? 'user' : 'assistant'}`}
            >
                {!isUser && <ReasoningBlock messageId={message.id} />}
                {isWaiting ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : isEmptyAssistant ? null : isUser ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                ) : (
                    <AssistantMarkdown content={message.content} streaming={isActive} />
                )}

                {notice && conversationId ? (
                    <ChatRunNotice conversationId={conversationId} notice={notice} answerHasText />
                ) : null}

                {isActive && !isWaiting ? (
                    <div
                        className="ai-chat__typing-indicator"
                        role="status"
                        aria-label={t('Réponse en cours')}
                    >
                        <span />
                        <span />
                        <span />
                    </div>
                ) : null}

                {isActive && message.toolResults.length > 0 ? (
                    <ToolResultsList results={message.toolResults} />
                ) : null}

                {retryUserMessageId && conversationId ? (
                    <div
                        className={`ai-chat__bubble-actions ${isUser ? 'ai-chat__bubble-actions--user' : ''}`}
                    >
                        <Tooltip title={t('Réessayer')}>
                            <Button
                                type="text"
                                size="small"
                                shape="circle"
                                className={`ai-chat__retry-button ${isUser ? 'ai-chat__retry-button--user' : ''}`}
                                icon={<ReloadOutlined />}
                                aria-label={t('Réessayer')}
                                onClick={() =>
                                    void retryLastUserMessage(conversationId, retryUserMessageId)
                                }
                            />
                        </Tooltip>
                    </div>
                ) : null}
            </SelectableMessageContent>
        </motion.div>
    );
});
