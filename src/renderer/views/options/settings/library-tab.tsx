import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import type { InstalledLanguage } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { LANGUAGE_EVENT } from '@renderer/utils/events';

const { Text } = Typography;

export default function LibraryTab() {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [langs, setLangs] = useState<InstalledLanguage[]>([]);

    const refreshInstalledLanguages = useCallback(() => {
        window.api.languages.getInstalled({ checkForUpdates: true }).then(setLangs);
    }, []);

    useEffect(() => {
        refreshInstalledLanguages();
    }, [refreshInstalledLanguages]);

    useEffect(() => {
        const refresh = () => refreshInstalledLanguages();
        window.addEventListener(LANGUAGE_EVENT.catalogChanged, refresh);
        return () => {
            window.removeEventListener(LANGUAGE_EVENT.catalogChanged, refresh);
        };
    }, [refreshInstalledLanguages]);

    const openManager = useCallback(() => {
        window.dispatchEvent(new Event(LANGUAGE_EVENT.openLibrary));
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
                        {t('Gérer la bibliothèque')}
                    </Button>
                </div>
                {langs.length === 0 ? (
                    <Text type="secondary">{t('Bibliothèque vide')}</Text>
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
                                {l.code === contentLanguage && (
                                    <Tag
                                        color="blue"
                                        icon={<CheckCircleOutlined />}
                                        style={{ marginLeft: 8 }}
                                    >
                                        {t('Actif')}
                                    </Tag>
                                )}
                                {l.updateAvailable && (
                                    <Tag color="gold" style={{ marginLeft: 8 }}>
                                        {t('Mise à jour disponible')}
                                    </Tag>
                                )}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                                {l.sermonsCount} {t('sermons')}
                            </Text>
                        </div>
                    ))
                )}
            </Space>
        </Card>
    );
}
