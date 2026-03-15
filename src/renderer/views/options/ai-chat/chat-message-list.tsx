import { useEffect, useRef } from 'react';
import { Empty, Spin, Typography } from 'antd';
import { LoadingOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import type { AiMessage } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import ChatToolResult from './chat-tool-result';

const { Text } = Typography;

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
    const isStreaming = sending && isLastAssistant && !message.content;

    return (
        <div className={`ai-chat__bubble ai-chat__bubble--${isUser ? 'user' : 'assistant'}`}>
            <div className={`ai-chat__avatar ai-chat__avatar--${isUser ? 'user' : 'assistant'}`}>
                {isUser ? <UserOutlined /> : <RobotOutlined />}
            </div>
            <div
                className={`ai-chat__bubble-content ai-chat__bubble-content--${isUser ? 'user' : 'assistant'}`}
            >
                {isStreaming ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : isUser ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                ) : (
                    <div className="ai-markdown">
                        <Markdown>{message.content}</Markdown>
                    </div>
                )}
                {message.toolResults.length > 0 ? (
                    <div className="ai-chat__tool-results">
                        {message.toolResults.map((result) => (
                            <ChatToolResult
                                key={`${result.toolCallId}-${result.name}`}
                                name={result.name}
                            />
                        ))}
                    </div>
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
