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
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Input.TextArea
                autoSize={{ minRows: 1, maxRows: 4 }}
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
            />
            {sending ? (
                <Button icon={<StopOutlined />} onClick={onStop}>
                    {t('Arrêter')}
                </Button>
            ) : (
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={onSend}
                    disabled={!draft.trim()}
                >
                    {t('Envoyer')}
                </Button>
            )}
        </div>
    );
}
