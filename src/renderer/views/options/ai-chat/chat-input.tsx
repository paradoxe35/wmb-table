import { Button, Input } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export default function ChatInput({
    draft,
    sending,
    onDraftChange,
    onSend,
    onStop,
}: {
    draft: string;
    sending: boolean;
    onDraftChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-end',
                padding: '8px 0 4px',
                borderTop: '1px solid var(--ant-color-border)',
            }}
        >
            <Input.TextArea
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
                style={{ flex: 1 }}
                variant="borderless"
            />
            {sending ? (
                <Button
                    shape="circle"
                    icon={<StopOutlined />}
                    onClick={onStop}
                    title={t('Arrêter')}
                />
            ) : (
                <Button
                    type="primary"
                    shape="circle"
                    icon={<SendOutlined />}
                    onClick={onSend}
                    disabled={!draft.trim()}
                    title={t('Envoyer')}
                />
            )}
        </div>
    );
}
