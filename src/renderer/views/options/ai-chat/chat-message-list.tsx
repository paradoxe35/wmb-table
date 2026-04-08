import { memo, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { Button, Empty, Spin, Tooltip, Typography } from 'antd';
import { BulbOutlined, LoadingOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';
import { useStickToBottom } from 'use-stick-to-bottom';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useAiChatStore, selectActiveProviderLabel } from '@renderer/stores/ai-chat.store';
import ChatToolResult from './chat-tool-result';
import AiReferenceLink from './ai-reference-link';

const { Text } = Typography;

function urlTransform(url: string): string {
    if (url.startsWith('wmb://')) {
        return url;
    }
    return defaultUrlTransform(url);
}

function sanitizeWmbLinks(content: string): string {
    return content
        .replace(/`(\[[^\]]+\]\(wmb:\/\/[^)]+\))`/g, '$1')
        .replace(
            /\]\(wmb:\/\/([^)]+)\)/g,
            (_, path: string) => `](wmb://${path.replace(/ /g, '%20')})`,
        );
}

const markdownComponents = {
    a: AiReferenceLink,
    table: ({ children, node: _node, ...props }: ComponentProps<'table'> & { node?: unknown }) => (
        <div className="ai-markdown__table-wrap">
            <table {...props}>{children}</table>
        </div>
    ),
};

const MAX_REASONING_LINES = 50;
const LOAD_OLDER_THRESHOLD_PX = 120;

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

interface GroupedToolResult {
    name: string;
    count: number;
}

function groupToolResults(results: AiToolResult[]): GroupedToolResult[] {
    const map = new Map<string, number>();
    for (const r of results) {
        map.set(r.name, (map.get(r.name) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function ToolResultsList({ results }: { results: AiToolResult[] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const grouped = groupToolResults([...results].reverse());
    const shouldCollapse = grouped.length > VISIBLE_TOOL_RESULTS;
    const visible = shouldCollapse && !expanded ? grouped.slice(0, VISIBLE_TOOL_RESULTS) : grouped;
    const hiddenCount = grouped.length - VISIBLE_TOOL_RESULTS;

    return (
        <div className="ai-chat__tool-results">
            {visible.map((g) => (
                <ChatToolResult key={g.name} name={g.name} count={g.count} />
            ))}
            {shouldCollapse && (
                <span className="ai-chat__tool-results-more" onClick={() => setExpanded((e) => !e)}>
                    {expanded
                        ? t('Voir moins')
                        : t(hiddenCount === 1 ? '+{{count}} autre' : '+{{count}} autres', {
                              count: hiddenCount,
                          })}
                </span>
            )}
        </div>
    );
}

const MessageBubble = memo(function MessageBubble({
    message,
    isActive,
}: {
    message: AiMessage;
    isActive: boolean;
}) {
    const isUser = message.role === 'user';
    const providerLabel = useAiChatStore(selectActiveProviderLabel);

    if (
        !isUser &&
        !isActive &&
        !message.content.trim() &&
        message.toolCalls.length === 0 &&
        message.toolResults.length === 0
    ) {
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

    const providerTooltip = isUser ? '' : providerLabel;

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

            <div
                className={`ai-chat__bubble-content ai-chat__bubble-content--${isUser ? 'user' : 'assistant'}`}
            >
                {!isUser && <ReasoningBlock messageId={message.id} />}
                {isWaiting ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : isUser ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                ) : (
                    <div className="ai-markdown">
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                            urlTransform={urlTransform}
                        >
                            {sanitizeWmbLinks(message.content)}
                        </Markdown>
                    </div>
                )}

                {isActive && !isWaiting ? (
                    <div className="ai-chat__typing-indicator">
                        <LoadingOutlined spin style={{ fontSize: 'var(--fs-sm)' }} />
                    </div>
                ) : null}

                {isActive && message.toolResults.length > 0 ? (
                    <ToolResultsList results={message.toolResults} />
                ) : null}
            </div>
        </motion.div>
    );
});

export default function ChatMessageList({
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

    // When leaving options view, break the sticky lock so the ResizeObserver
    // doesn't auto-scroll to bottom when the chat becomes visible again.
    const prevMainView = useRef(mainView);
    const prevOptionView = useRef(optionView);

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
        pendingInitialScrollConversation.current = null;
    }, [conversationKey, loading, scrollRef, stopScroll]);

    // Scroll to bottom when user sends a new message
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
        prependScrollSnapshot.current = null;
    }, [loadingOlder, messages.length, scrollRef]);

    function handleScroll(): void {
        const el = scrollRef.current;
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
    }

    return (
        <div className="ai-chat__messages-wrapper">
            <div className="ai-chat__messages" ref={scrollRef} onScroll={handleScroll}>
                <div className="ai-chat__messages-content" ref={contentRef}>
                    {loadingOlder ? (
                        <div className="ai-chat__history-loading">
                            <Spin indicator={<LoadingOutlined spin />} size="small" />
                        </div>
                    ) : null}
                    {messages.length === 0 && !hasQueuedMessages && !loading ? (
                        <EmptyChat onQuickStart={onQuickStart} />
                    ) : (
                        <AnimatePresence initial={false}>
                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isActive={msg.id === activeAssistantMessageId}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
            {loading && (
                <div className="ai-chat__loading-overlay" aria-hidden="true">
                    <Spin indicator={<LoadingOutlined spin />} size="large" />
                </div>
            )}
            {!isAtBottom && (
                <button className="ai-chat__scroll-bottom" onClick={() => scrollToBottom()}>
                    ↓
                </button>
            )}
        </div>
    );
}

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
