import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, InputNumber, Space, Switch, Typography, message } from 'antd';
import { BookOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { MIN_MAX_TABS, MAX_MAX_TABS } from '@shared/constants';

const { Text } = Typography;

export default function DocumentViewTab() {
    const { t } = useTranslation();
    const rememberReadingPosition = useAppStore((s) => s.rememberReadingPosition);
    const setRememberReadingPosition = useAppStore((s) => s.setRememberReadingPosition);
    const maxTabs = useAppStore((s) => s.maxTabs);
    const setMaxTabs = useAppStore((s) => s.setMaxTabs);
    const [saving, setSaving] = useState(false);

    const handleMaxTabsChange = (value: number | null) => {
        if (value == null) return;
        window.api.app
            .setMaxTabs(value)
            .then(() => setMaxTabs(value))
            .catch(() => message.error(t("Impossible d'enregistrer le paramètre")));
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" variant="borderless">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                    }}
                >
                    <Space orientation="vertical" size={2}>
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

            <Card size="small" variant="borderless">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                    }}
                >
                    <Space orientation="vertical" size={2}>
                        <Space size="small">
                            <Text type="secondary">
                                <AppstoreOutlined />
                            </Text>
                            <Text>{t("Nombre maximum d'onglets")}</Text>
                        </Space>
                        <Text type="secondary">
                            {t(
                                'Les onglets les plus anciens seront fermés automatiquement lorsque la limite est atteinte ({{min}}-{{max}}).',
                                { min: MIN_MAX_TABS, max: MAX_MAX_TABS },
                            )}
                        </Text>
                    </Space>
                    <InputNumber
                        min={MIN_MAX_TABS}
                        max={MAX_MAX_TABS}
                        value={maxTabs}
                        onChange={handleMaxTabsChange}
                        style={{ width: 80 }}
                    />
                </div>
            </Card>
        </Space>
    );
}
