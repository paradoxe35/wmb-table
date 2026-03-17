import { useEffect, useRef, useState } from 'react';
import { Empty, Spin, Tooltip, Typography } from 'antd';
import { BulbOutlined, LoadingOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import type { AiMessage, AiToolResult } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
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

const MAX_REASONING_LINES = 50;

function ReasoningBlock({ messageId, isActive }: { messageId: string; isActive: boolean }) {
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
                <Text type="secondary" style={{ fontSize: '0.8em' }}>
                    {collapsed ? t('Voir le raisonnement') : t('Masquer le raisonnement')}
                </Text>
                {isActive && <LoadingOutlined spin style={{ fontSize: 10 }} />}
            </div>
            {!collapsed && (
                <div className="ai-reasoning__content">
                    {wasTruncated && (
                        <Text
                            type="secondary"
                            style={{ fontSize: '0.75em', display: 'block', marginBottom: 4 }}
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

function ToolResultsList({ results, isActive }: { results: AiToolResult[]; isActive: boolean }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    if (isActive) {
        const reversed = [...results].reverse();
        const visible =
            results.length > VISIBLE_TOOL_RESULTS
                ? reversed.slice(0, VISIBLE_TOOL_RESULTS)
                : reversed;

        return (
            <div className="ai-chat__tool-results">
                {visible.map((result) => (
                    <ChatToolResult
                        key={`${result.toolCallId}-${result.name}`}
                        name={result.name}
                    />
                ))}
                <LoadingOutlined spin style={{ fontSize: 10, opacity: 0.5 }} />
            </div>
        );
    }

    const grouped = groupToolResults(results);
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

function MessageBubble({
    message,
    isLastAssistant,
    sending,
}: {
    message: AiMessage;
    isLastAssistant: boolean;
    sending: boolean;
}) {
    const isUser = message.role === 'user';
    const isActive = sending && isLastAssistant;
    const isWaiting = isActive && !message.content;

    const avatarClass = [
        'ai-chat__avatar',
        `ai-chat__avatar--${isUser ? 'user' : 'assistant'}`,
        isActive ? 'ai-chat__avatar--active' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const providerLabel = useAiChatStore(selectActiveProviderLabel);
    const providerTooltip = isUser ? '' : providerLabel;

    return (
        <div className={`ai-chat__bubble ai-chat__bubble--${isUser ? 'user' : 'assistant'}`}>
            <Tooltip title={providerTooltip} placement="top">
                <div className={avatarClass}>{isUser ? <UserOutlined /> : <RobotOutlined />}</div>
            </Tooltip>
            <div
                className={`ai-chat__bubble-content ai-chat__bubble-content--${isUser ? 'user' : 'assistant'}`}
            >
                {!isUser && <ReasoningBlock messageId={message.id} isActive={isActive} />}
                {isWaiting ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : isUser ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                ) : (
                    <div className="ai-markdown">
                        <Markdown components={{ a: AiReferenceLink }} urlTransform={urlTransform}>
                            {message.content}
                        </Markdown>
                    </div>
                )}
                {isActive && !isWaiting ? (
                    <div className="ai-chat__typing-indicator">
                        <LoadingOutlined spin style={{ fontSize: 12 }} />
                    </div>
                ) : null}
                {isActive && message.toolResults.length > 0 ? (
                    <ToolResultsList results={message.toolResults} isActive={isActive} />
                ) : null}
            </div>
        </div>
    );
}

export default function ChatMessageList({
    messages,
    sending,
}: {
    messages: AiMessage[];
    sending: boolean;
}) {
    const { t } = useTranslation();
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        const prevCount = prevCountRef.current;
        const currCount = messages.length;
        prevCountRef.current = currCount;

        // Jump instantly when loading a conversation (many messages at once or switching)
        // Smooth scroll only for incremental updates (new message while chatting)
        const isConversationSwitch = Math.abs(currCount - prevCount) > 1 || prevCount === 0;
        bottomRef.current?.scrollIntoView(
            isConversationSwitch ? undefined : { behavior: 'smooth' },
        );
    }, [messages, sending]);

    return (
        <div className="ai-chat__messages">
            {messages.length === 0 ? (
                <div className="ai-chat__empty">
                    <Empty
                        image={
                            <RobotOutlined
                                style={{
                                    fontSize: 40,
                                    color: 'var(--ant-color-text-quaternary)',
                                }}
                            />
                        }
                        description={
                            <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                {t('Posez votre question...')}
                            </Text>
                        }
                    />
                </div>
            ) : (
                messages.map((msg, i) => {
                    const isLastAssistant =
                        msg.role === 'assistant' &&
                        !messages.slice(i + 1).some((m) => m.role === 'assistant');
                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isLastAssistant={isLastAssistant}
                            sending={sending}
                        />
                    );
                })
            )}
            <div ref={bottomRef} />
        </div>
    );
}
