import { Button, Input } from 'antd';
import { ArrowUpOutlined, StopOutlined } from '@ant-design/icons';
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
        <div className="ai-chat__input-wrapper">
            <div className="ai-chat__input-box">
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
                    variant="borderless"
                    className="ai-chat__input-textarea"
                />
                <div className="ai-chat__input-actions">
                    {sending ? (
                        <Button
                            size="small"
                            shape="circle"
                            icon={<StopOutlined style={{ fontSize: 12 }} />}
                            onClick={onStop}
                            title={t('Arrêter')}
                        />
                    ) : (
                        <Button
                            type="primary"
                            size="small"
                            shape="circle"
                            icon={<ArrowUpOutlined style={{ fontSize: 13, fontWeight: 700 }} />}
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
