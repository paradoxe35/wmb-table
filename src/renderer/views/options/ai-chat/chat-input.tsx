import { useEffect, useRef } from 'react';
import { Button, Input, type InputRef } from 'antd';
import { ArrowUpOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export default function ChatInput({
    draft,
    sending,
    conversationId,
    completionCount,
    lastCompletedConversationId,
    onDraftChange,
    onSend,
    onStop,
}: {
    draft: string;
    sending: boolean;
    conversationId: string | null;
    completionCount: number;
    lastCompletedConversationId: string | null;
    onDraftChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
}) {
    const { t } = useTranslation();
    const inputRef = useRef<InputRef>(null);
    const wasSending = useRef(false);

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
            <div className="ai-chat__input-box">
                <Input.TextArea
                    ref={inputRef}
                    autoSize={{ minRows: 1, maxRows: 5 }}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onPressEnter={(e) => {
                        if (!e.shiftKey) {
                            e.preventDefault();
                            onSend();
                        }
                    }}
                    placeholder={t('Posez votre question...')}
                    variant="borderless"
                    className="ai-chat__input-textarea"
                />
                <div className="ai-chat__input-actions">
                    {sending ? (
                        <Button
                            size="small"
                            shape="circle"
                            icon={<StopOutlined style={{ fontSize: 'var(--fs-sm)' }} />}
                            onClick={onStop}
                            title={t('Arrêter')}
                        />
                    ) : (
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
                            title={t('Envoyer')}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
