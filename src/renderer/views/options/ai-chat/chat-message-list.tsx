import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Spin, Tooltip, Typography } from 'antd';
import {
    BulbOutlined,
    LoadingOutlined,
    ReloadOutlined,
    RobotOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useStickToBottom } from 'use-stick-to-bottom';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useAiChatStore, selectActiveProviderLabel } from '@renderer/stores/ai-chat.store';
import ChatToolResult from './chat-tool-result';
import ChatRunNotice from './chat-run-notice';
import { groupToolResults } from './tool-results';
import AssistantMarkdown from './assistant-markdown';
import SelectableMessageContent from './selectable-message-content';

const { Text } = Typography;
const MAX_REASONING_LINES = 50;
const LOAD_OLDER_THRESHOLD_PX = 200;
const SCROLL_TOP_FADE_THRESHOLD_PX = 2;

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

function canRetryUserMessageAtIndex(messages: AiMessage[], index: number): boolean {
    const message = messages[index];
    if (!message || message.role !== 'user') {
        return false;
    }

    const followingMessages = messages.slice(index + 1);
    return followingMessages.every(
        (following) => following.role === 'assistant' && !following.content.trim(),
    );
}

function isEmptyAssistantMessage(message: AiMessage | undefined): boolean {
    return Boolean(message && message.role === 'assistant' && !message.content.trim());
}

function findRetryableUserMessageIdForEmptyAssistant(
    messages: AiMessage[],
    index: number,
): string | null {
    if (!isEmptyAssistantMessage(messages[index])) {
        return null;
    }

    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (messages[cursor].role !== 'user') {
            continue;
        }

        return canRetryUserMessageAtIndex(messages, cursor) ? messages[cursor].id : null;
    }

    return null;
}

function resolveRetryUserMessageId(
    messages: AiMessage[],
    index: number,
    lastMessageId: string | null,
): string | null {
    const message = messages[index];
    if (!message) {
        return null;
    }

    if (message.role === 'user') {
        return message.id === lastMessageId ? message.id : null;
    }

    return findRetryableUserMessageIdForEmptyAssistant(messages, index);
}

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
                <ChatToolResult key={g.name} name={g.name} count={g.count} />
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

const MessageBubble = memo(function MessageBubble({
    conversationId,
    message,
    isActive,
    retryUserMessageId,
}: {
    conversationId: string | null;
    message: AiMessage;
    isActive: boolean;
    retryUserMessageId: string | null;
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

                {!isUser && !isActive ? <ChatRunNotice messageId={message.id} /> : null}

                {isActive && !isWaiting ? (
                    <div className="ai-chat__typing-indicator">
                        <LoadingOutlined spin style={{ fontSize: 'var(--fs-sm)' }} />
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

const ChatMessageList = memo(function ChatMessageList({
    conversationId,
    messages,
    sending,
    activeAssistantMessageId,
    hasQueuedMessages,
    queuedMessageCount,
    loading,
    loadingOlder,
    hasMoreHistory,
    onLoadOlderMessages,
    onQuickStart,
}: {
    conversationId: string | null;
    messages: AiMessage[];
    sending: boolean;
    activeAssistantMessageId: string | null;
    hasQueuedMessages: boolean;
    queuedMessageCount: number;
    loading: boolean;
    loadingOlder: boolean;
    hasMoreHistory: boolean;
    onLoadOlderMessages: () => Promise<void>;
    onQuickStart: (prompt: string) => void;
}) {
    const { t } = useTranslation();
    const mainView = useAppStore((s) => s.mainView);
    const optionView = useAppStore((s) => s.optionView);

    const { scrollRef, contentRef, isAtBottom, scrollToBottom, stopScroll } = useStickToBottom({
        resize: 'smooth',
    });

    // Scroll to bottom instantly before paint on conversation switch and
    // again when loaded messages land for the selected conversation.
    const conversationKey = conversationId ?? 'empty';
    const pendingInitialScrollConversation = useRef<string | null>(null);
    const prependScrollSnapshot = useRef<{ height: number; top: number } | null>(null);
    const showTopFadeRef = useRef(false);
    const [showTopFade, setShowTopFade] = useState(false);

    // When leaving options view, break the sticky lock so the ResizeObserver
    // doesn't auto-scroll to bottom when the chat becomes visible again.
    const prevMainView = useRef(mainView);
    const prevOptionView = useRef(optionView);

    const updateTopFade = useCallback(() => {
        const nextShowTopFade = (scrollRef.current?.scrollTop ?? 0) > SCROLL_TOP_FADE_THRESHOLD_PX;
        if (showTopFadeRef.current === nextShowTopFade) {
            return;
        }
        showTopFadeRef.current = nextShowTopFade;
        setShowTopFade(nextShowTopFade);
    }, [scrollRef]);

    useEffect(() => {
        if (prevMainView.current !== 'options' && mainView === 'options') {
            stopScroll();
        } else if (mainView === 'options' && prevOptionView.current !== 'ai-chat') {
            stopScroll();
        }

        prevOptionView.current = optionView;
        prevMainView.current = mainView;
    }, [mainView, optionView, stopScroll]);

    useLayoutEffect(() => {
        pendingInitialScrollConversation.current = conversationKey;
    }, [conversationKey]);

    useLayoutEffect(() => {
        if (loading || pendingInitialScrollConversation.current !== conversationKey) {
            return;
        }

        stopScroll();
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
        updateTopFade();
        pendingInitialScrollConversation.current = null;
    }, [conversationKey, loading, scrollRef, stopScroll, updateTopFade]);

    const prevSending = useRef(sending);
    useEffect(() => {
        if (sending && !prevSending.current) {
            scrollToBottom();
        }
        prevSending.current = sending;
    }, [sending, scrollToBottom]);

    const prevQueuedMessageCount = useRef(queuedMessageCount);
    useEffect(() => {
        if (queuedMessageCount > prevQueuedMessageCount.current) {
            scrollToBottom();
        }

        prevQueuedMessageCount.current = queuedMessageCount;
    }, [queuedMessageCount, scrollToBottom]);

    useLayoutEffect(() => {
        if (loadingOlder || !prependScrollSnapshot.current) {
            return;
        }

        const el = scrollRef.current;
        if (!el) {
            prependScrollSnapshot.current = null;
            return;
        }

        const snapshot = prependScrollSnapshot.current;
        el.scrollTop = el.scrollHeight - snapshot.height + snapshot.top;
        updateTopFade();
        prependScrollSnapshot.current = null;
    }, [loadingOlder, messages.length, scrollRef, updateTopFade]);

    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    const renderedMessages = useMemo(
        () =>
            messages.map((msg, index) => {
                let retryUserMessageId: string | null = null;
                if (conversationId && !sending) {
                    retryUserMessageId = resolveRetryUserMessageId(messages, index, lastMessageId);
                }

                return (
                    <MessageBubble
                        key={msg.id}
                        conversationId={conversationId}
                        message={msg}
                        isActive={msg.id === activeAssistantMessageId}
                        retryUserMessageId={retryUserMessageId}
                    />
                );
            }),
        [activeAssistantMessageId, conversationId, lastMessageId, messages, sending],
    );

    const handleScroll = useCallback((): void => {
        const el = scrollRef.current;
        updateTopFade();
        if (
            !el ||
            loading ||
            loadingOlder ||
            !hasMoreHistory ||
            el.scrollTop > LOAD_OLDER_THRESHOLD_PX
        ) {
            return;
        }

        prependScrollSnapshot.current = {
            height: el.scrollHeight,
            top: el.scrollTop,
        };
        void onLoadOlderMessages();
    }, [hasMoreHistory, loading, loadingOlder, onLoadOlderMessages, scrollRef, updateTopFade]);

    return (
        <div className="ai-chat__messages-wrapper">
            <div className="ai-chat__messages" ref={scrollRef} onScroll={handleScroll}>
                <div className="ai-chat__messages-content" ref={contentRef}>
                    {loadingOlder ? (
                        <div className="ai-chat__history-loading">
                            <Spin indicator={<LoadingOutlined spin />} size="small" />
                        </div>
                    ) : null}
                    {(!conversationId && !loading) ||
                    (messages.length === 0 && !hasQueuedMessages && !loading) ? (
                        <EmptyChat onQuickStart={onQuickStart} />
                    ) : (
                        <AnimatePresence initial={false}>{renderedMessages}</AnimatePresence>
                    )}
                </div>
            </div>
            <div
                className={`ai-chat__edge-fade ai-chat__edge-fade--top ${showTopFade ? 'is-visible' : ''}`}
                aria-hidden="true"
            />
            {loading && (
                <div className="ai-chat__loading-overlay" aria-hidden="true">
                    <Spin indicator={<LoadingOutlined spin />} size="large" />
                </div>
            )}
            {!isAtBottom && (
                <button
                    className="ai-chat__scroll-bottom"
                    onClick={() => scrollToBottom()}
                    title={t('Aller en bas')}
                    aria-label={t('Aller en bas')}
                >
                    ↓
                </button>
            )}
        </div>
    );
});

export default ChatMessageList;

function EmptyChat({ onQuickStart }: { onQuickStart: (prompt: string) => void }) {
    const { t } = useTranslation();
    const quickStartPrompts = [
        t('Suggère-moi un thème à étudier.'),
        t('Aide-moi à formuler une question de recherche.'),
        t('Trouve-moi quelques références utiles sur un sujet.'),
        t('Compare plusieurs références sur un même sujet.'),
    ];

    return (
        <div className="ai-chat__empty">
            <div className="ai-chat__empty-content">
                <Empty
                    image={
                        <RobotOutlined
                            style={{
                                fontSize: 'var(--fs-10xl)',
                                color: 'var(--ant-color-text-quaternary)',
                            }}
                        />
                    }
                    description={false}
                />
                <div className="ai-chat__quick-start">
                    <Text type="secondary" className="ai-chat__quick-start-title">
                        {t('Essayez une question pour commencer')}
                    </Text>
                    <div className="ai-chat__quick-start-list">
                        {quickStartPrompts.map((prompt) => (
                            <Button
                                key={prompt}
                                type="default"
                                className="ai-chat__quick-start-btn"
                                onClick={() => onQuickStart(prompt)}
                            >
                                {prompt}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
