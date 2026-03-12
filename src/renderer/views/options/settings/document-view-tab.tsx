import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Space, Switch, Typography, message } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';

const { Text } = Typography;

export default function DocumentViewTab() {
    const { t } = useTranslation();
    const rememberReadingPosition = useAppStore((s) => s.rememberReadingPosition);
    const setRememberReadingPosition = useAppStore((s) => s.setRememberReadingPosition);
    const [saving, setSaving] = useState(false);

    return (
        <Card size="small" variant="borderless">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                }}
            >
                <Space direction="vertical" size={2}>
                    <Space size="small">
                        <Text type="secondary">
                            <BookOutlined />
                        </Text>
                        <Text>{t('Mémoriser la position de lecture')}</Text>
                    </Space>
                    <Text type="secondary">
                        {t("Rouvrez un document là où vous l'aviez laissé la dernière fois.")}
                    </Text>
                </Space>
                <Switch
                    checked={rememberReadingPosition}
                    loading={saving}
                    onChange={(checked) => {
                        setSaving(true);
                        window.api.app
                            .setRememberReadingPosition(checked)
                            .then(() => setRememberReadingPosition(checked))
                            .catch(() => {
                                message.error(t("Impossible d'enregistrer le paramètre"));
                            })
                            .finally(() => setSaving(false));
                    }}
                />
            </div>
        </Card>
    );
}
