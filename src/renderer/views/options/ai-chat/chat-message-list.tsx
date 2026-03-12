import { useEffect, useRef } from 'react';
import { Empty, Spin, Typography } from 'antd';
import { LoadingOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import type { AiMessage } from '@shared/ai.types';
import { useTranslation } from 'react-i18next';
import ChatToolResult from './chat-tool-result';

const { Text } = Typography;

function MessageBubble({ message, sending }: { message: AiMessage; sending: boolean }) {
    const isUser = message.role === 'user';
    const isStreaming = sending && !isUser && !message.content;

    return (
        <div
            style={{
                display: 'flex',
                gap: 10,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                flexDirection: isUser ? 'row-reverse' : 'row',
            }}
        >
            <div
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: isUser
                        ? 'var(--ant-color-primary)'
                        : 'var(--ant-color-bg-container-disabled)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                }}
            >
                {isUser ? (
                    <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                ) : (
                    <RobotOutlined style={{ fontSize: 14 }} />
                )}
            </div>
            <div
                style={{
                    padding: isUser ? '8px 14px' : '6px 14px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isUser
                        ? 'var(--ant-color-primary-bg)'
                        : 'var(--ant-color-bg-layout)',
                    minWidth: 40,
                }}
            >
                {isStreaming ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : isUser ? (
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                ) : (
                    <div className="ai-markdown">
                        <Markdown>{message.content}</Markdown>
                    </div>
                )}
                {message.toolResults.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
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

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '12px 4px',
            }}
        >
            {messages.length === 0 ? (
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Empty
                        image={<RobotOutlined style={{ fontSize: 40, color: '#8c8c8c' }} />}
                        description={<Text type="secondary">{t('Posez votre question...')}</Text>}
                    />
                </div>
            ) : (
                messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} sending={sending} />
                ))
            )}
            <div ref={bottomRef} />
        </div>
    );
}
