import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Spin, Typography } from 'antd';
import { LoadingOutlined, RobotOutlined } from '@ant-design/icons';
import { AnimatePresence } from 'framer-motion';
import { useStickToBottom } from 'use-stick-to-bottom';
import type { AiMessage } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import type { AiRunNotice } from '@renderer/stores/ai-chat/chat-state';
import ChatRunNotice from './chat-run-notice';
import { MessageBubble } from './message-bubble';
import { resolveRetryUserMessageId } from './message-retry';

const { Text } = Typography;
const LOAD_OLDER_THRESHOLD_PX = 200;
const SCROLL_TOP_FADE_THRESHOLD_PX = 2;

/** The notice sits inside its answer when that answer is shown, otherwise below the thread. */
function hasVisibleAnswer(messages: AiMessage[], notice: AiRunNotice | null): boolean {
    return Boolean(
        notice?.messageId &&
        messages.some((message) => message.id === notice.messageId && message.content.trim()),
    );
}

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
    runNotice,
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
    runNotice: AiRunNotice | null;
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
    const noticeInAnswer = hasVisibleAnswer(messages, runNotice);
    const renderedMessages = useMemo(
        () =>
            messages.map((msg, index) => {
                const canRetry = conversationId && !sending && !runNotice;
                return (
                    <MessageBubble
                        key={msg.id}
                        conversationId={conversationId}
                        message={msg}
                        isActive={msg.id === activeAssistantMessageId}
                        retryUserMessageId={
                            canRetry
                                ? resolveRetryUserMessageId(messages, index, lastMessageId)
                                : null
                        }
                        notice={
                            noticeInAnswer && runNotice?.messageId === msg.id ? runNotice : null
                        }
                    />
                );
            }),
        [
            activeAssistantMessageId,
            conversationId,
            lastMessageId,
            messages,
            noticeInAnswer,
            runNotice,
            sending,
        ],
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
                    {runNotice && conversationId && !noticeInAnswer ? (
                        <div className="ai-chat__notice-row">
                            <ChatRunNotice
                                conversationId={conversationId}
                                notice={runNotice}
                                answerHasText={false}
                            />
                        </div>
                    ) : null}
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
