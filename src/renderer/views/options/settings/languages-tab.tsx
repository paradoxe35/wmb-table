import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import type { InstalledLanguage } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';

const { Text } = Typography;

export default function LanguagesTab() {
    const { t } = useTranslation();
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [langs, setLangs] = useState<InstalledLanguage[]>([]);

    useEffect(() => {
        window.api.languages.getInstalled().then(setLangs);
    }, []);

    const openManager = useCallback(() => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLanguageManager));
    }, []);

    return (
        <Card size="small" variant="borderless">
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Text strong>
                        <GlobalOutlined /> {t('Langues installées')}
                    </Text>
                    <Button size="small" onClick={openManager}>
                        {t('Changer la langue')}
                    </Button>
                </div>
                {langs.length === 0 ? (
                    <Text type="secondary">{t('Aucune langue installée')}</Text>
                ) : (
                    langs.map((l) => (
                        <div
                            key={l.code}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '4px 0',
                            }}
                        >
                            <Text>
                                {l.language}
                                {l.code === activeLanguage && (
                                    <Tag
                                        color="blue"
                                        icon={<CheckCircleOutlined />}
                                        style={{ marginLeft: 8 }}
                                    >
                                        {t('Actif')}
                                    </Tag>
                                )}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                {l.sermonsCount} {t('sermons')}
                            </Text>
                        </div>
                    ))
                )}
            </Space>
        </Card>
    );
}
