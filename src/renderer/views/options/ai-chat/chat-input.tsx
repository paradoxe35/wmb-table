import { memo, useEffect, useRef } from 'react';
import { Button, Input, type InputRef } from 'antd';
import { ArrowUpOutlined, CloseOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const ChatInput = memo(function ChatInput({
    draft,
    sending,
    runStatus,
    queuedMessages,
    conversationId,
    completionCount,
    lastCompletedConversationId,
    onDraftChange,
    onSend,
    onStop,
    onRemoveQueuedMessage,
    onResendQueue,
}: {
    draft: string;
    sending: boolean;
    runStatus: 'starting' | 'streaming' | 'stopping' | null;
    queuedMessages: { id: string; content: string }[];
    conversationId: string | null;
    completionCount: number;
    lastCompletedConversationId: string | null;
    onDraftChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    onRemoveQueuedMessage: (queuedMessageId: string) => void;
    onResendQueue: () => void;
}) {
    const { t } = useTranslation();
    const inputRef = useRef<InputRef>(null);
    const wasSending = useRef(false);
    const newLineShortcut = t('Maj+Entrée');
    const placeholderText = sending
        ? t("Ajoutez un message à la file d'attente... ({{shortcut}} pour une nouvelle ligne)", {
              shortcut: newLineShortcut,
          })
        : t('Posez votre question... ({{shortcut}} pour une nouvelle ligne)', {
              shortcut: newLineShortcut,
          });

    // Focus on mount and when conversation changes (new conversation or switch)
    useEffect(() => {
        inputRef.current?.focus();
    }, [conversationId]);

    // Focus after AI reply finishes
    useEffect(() => {
        if (wasSending.current && !sending) {
            inputRef.current?.focus();
        }
        wasSending.current = sending;
    }, [sending]);

    useEffect(() => {
        if (
            completionCount <= 0 ||
            !conversationId ||
            lastCompletedConversationId !== conversationId
        ) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [completionCount, conversationId, lastCompletedConversationId]);

    return (
        <div className="ai-chat__input-wrapper">
            {queuedMessages.length > 0 ? (
                <div className="ai-chat__queue-panel">
                    <div className="ai-chat__queue-header">
                        <span className="ai-chat__queue-title">
                            {t(
                                queuedMessages.length === 1
                                    ? '{{count}} message en attente'
                                    : '{{count}} messages en attente',
                                { count: queuedMessages.length },
                            )}
                        </span>
                        <span className="ai-chat__queue-caption">
                            {sending
                                ? t('Ils seront envoyés dès que cette réponse se termine.')
                                : t("En attente d'envoi.")}
                        </span>
                        {sending ? null : (
                            <Button
                                size="small"
                                type="link"
                                icon={<SendOutlined />}
                                className="ai-chat__queue-resend"
                                onClick={onResendQueue}
                            >
                                {t('Renvoyer')}
                            </Button>
                        )}
                    </div>
                    <div className="ai-chat__queue-list">
                        {queuedMessages.map((message, index) => (
                            <div key={message.id} className="ai-chat__queue-item">
                                <div className="ai-chat__queue-item-copy">
                                    <div className="ai-chat__queue-item-order">{index + 1}</div>
                                    <div className="ai-chat__queue-item-content">
                                        {message.content}
                                    </div>
                                </div>
                                <Button
                                    className="ai-chat__queue-remove"
                                    type="text"
                                    size="small"
                                    shape="circle"
                                    icon={
                                        <CloseOutlined
                                            style={{ fontSize: 'var(--fs-xs)', lineHeight: 1 }}
                                        />
                                    }
                                    onClick={() => onRemoveQueuedMessage(message.id)}
                                    title={t('Retirer de la file')}
                                    aria-label={t('Retirer de la file')}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className="ai-chat__input-box">
                <Input.TextArea
                    ref={inputRef}
                    autoSize={{ minRows: 1, maxRows: 5 }}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onPressEnter={(e) => {
                        if (e.shiftKey) {
                            return;
                        }

                        e.preventDefault();
                        onSend();
                    }}
                    placeholder=""
                    aria-label={placeholderText}
                    variant="borderless"
                    className="ai-chat__input-textarea"
                />
                {!draft && <span className="ai-chat__input-placeholder">{placeholderText}</span>}
                <div className="ai-chat__input-actions">
                    {sending ? (
                        <Button
                            type="text"
                            size="small"
                            shape="circle"
                            icon={<StopOutlined style={{ fontSize: 'var(--fs-sm)' }} />}
                            onClick={onStop}
                            disabled={runStatus === 'stopping'}
                            title={t('Arrêter')}
                            aria-label={t('Arrêter')}
                        />
                    ) : null}
                    <Button
                        type="primary"
                        size="small"
                        shape="circle"
                        icon={
                            <ArrowUpOutlined
                                style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}
                            />
                        }
                        onClick={onSend}
                        disabled={!draft.trim()}
                        title={sending ? t("Ajouter à la file d'attente") : t('Envoyer')}
                        aria-label={sending ? t("Ajouter à la file d'attente") : t('Envoyer')}
                    />
                </div>
            </div>
        </div>
    );
});

export default ChatInput;
