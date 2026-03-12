import { useEffect, useRef } from 'react';
import { Empty, Spin, Typography } from 'antd';
import { LoadingOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
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
                gap: 8,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                flexDirection: isUser ? 'row-reverse' : 'row',
            }}
        >
            <div
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isUser
                        ? 'var(--ant-color-primary)'
                        : 'var(--ant-color-bg-container-disabled)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
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
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: isUser
                        ? 'var(--ant-color-primary-bg)'
                        : 'var(--ant-color-bg-layout)',
                    minWidth: 40,
                }}
            >
                {isStreaming ? (
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                ) : (
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                )}
                {message.toolResults.length > 0 ? (
                    <div style={{ marginTop: 6 }}>
                        {message.toolResults.map((result) => (
                            <ChatToolResult
                                key={`${result.toolCallId}-${result.name}`}
                                name={result.name}
                                output={result.output}
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
                padding: '12px 0',
            }}
        >
            {messages.length === 0 ? (
                <Empty
                    image={<RobotOutlined style={{ fontSize: 36, color: '#8c8c8c' }} />}
                    description={t('Posez votre question...')}
                />
            ) : (
                messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} sending={sending} />
                ))
            )}
            <div ref={bottomRef} />
        </div>
    );
}
