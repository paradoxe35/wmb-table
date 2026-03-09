import { useEffect, useState } from 'react';
import { Card, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { BackupStatus, InstalledLanguage, UpdaterNotification } from '@shared/types';
import { useAppStore } from '@renderer/stores';

const { Text } = Typography;

export default function GeneralTab() {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [langName, setLangName] = useState('');
    const [installedCount, setInstalledCount] = useState(0);
    const [updateInfo, setUpdateInfo] = useState<UpdaterNotification | null>(null);
    const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);

    useEffect(() => {
        window.api.languages.getInstalled().then((langs: InstalledLanguage[]) => {
            setInstalledCount(langs.length);
            if (activeLanguage) {
                const lang = langs.find((l) => l.code === activeLanguage);
                if (lang) setLangName(lang.language);
            }
        });
        window.api.app.getUpdateStatus().then(setUpdateInfo);
        window.api.backup.getStatus().then((s) => {
            if (s) setBackupStatus(s);
        });
    }, [activeLanguage]);

    return (
        <Card size="small" variant="borderless">
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <Text strong>
                    <InfoCircleOutlined /> Application
                </Text>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Langue active</Text>
                    <Text>{langName || '—'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Langues installées</Text>
                    <Text>{installedCount}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Sauvegarde</Text>
                    {backupStatus?.active ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                            Actif
                        </Tag>
                    ) : backupStatus ? (
                        <Tag>En pause</Tag>
                    ) : (
                        <Text type="secondary">Non connecté</Text>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Mise à jour</Text>
                    {updateInfo?.type === 'hasUpdate' ? (
                        <Tag color="blue">v{updateInfo.updateInfo?.version} disponible</Tag>
                    ) : (
                        <Text type="secondary">À jour</Text>
                    )}
                </div>
            </Space>
        </Card>
    );
}
