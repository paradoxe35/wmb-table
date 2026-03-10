import { useCallback, useEffect, useState } from 'react';
import { Card, Space, Tag, Typography } from 'antd';
import {
    CheckCircleOutlined,
    CloudSyncOutlined,
    GlobalOutlined,
    PauseCircleOutlined,
    ReloadOutlined,
    TranslationOutlined,
} from '@ant-design/icons';
import type { BackupStatus, InstalledLanguage, UpdaterNotification } from '@shared/types';
import { useAppStore } from '@renderer/stores';

const { Text } = Typography;

export default function GeneralTab() {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const [langName, setLangName] = useState('');
    const [installedCount, setInstalledCount] = useState(0);
    const [updateInfo, setUpdateInfo] = useState<UpdaterNotification | null>(null);
    const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);

    const refreshBackup = useCallback(() => {
        window.api.backup.getStatus().then((s) => {
            if (s) setBackupStatus(s);
        });
    }, []);

    useEffect(() => {
        window.api.languages.getInstalled().then((langs: InstalledLanguage[]) => {
            setInstalledCount(langs.length);
            if (activeLanguage) {
                const lang = langs.find((l) => l.code === activeLanguage);
                if (lang) setLangName(lang.language);
            }
        });
        window.api.app.getUpdateStatus().then(setUpdateInfo);
        refreshBackup();
    }, [activeLanguage, refreshBackup]);

    // Stay in sync when backup status changes
    useEffect(() => {
        const cleanupAccess = window.api.on.backupAccessStatus(() => refreshBackup());
        const handleSync = () => refreshBackup();
        window.addEventListener('sync-completed', handleSync);
        return () => {
            cleanupAccess();
            window.removeEventListener('sync-completed', handleSync);
        };
    }, [refreshBackup]);

    // Stay in sync when update status changes
    useEffect(() => {
        return window.api.on.notifyForNewUpdate(setUpdateInfo);
    }, []);

    const backupValue = backupStatus?.active ? (
        <Tag color="green" icon={<CheckCircleOutlined />}>
            Actif
        </Tag>
    ) : backupStatus ? (
        <Tag icon={<PauseCircleOutlined />}>En pause</Tag>
    ) : (
        <Text type="secondary">Non connecté</Text>
    );

    const updateValue =
        updateInfo?.type === 'hasUpdate' ? (
            <Tag color="blue">v{updateInfo.updateInfo?.version} disponible</Tag>
        ) : (
            <Tag color="green" icon={<CheckCircleOutlined />}>
                À jour
            </Tag>
        );

    const items: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
        {
            icon: <TranslationOutlined />,
            label: 'Langue active',
            value: <Text>{langName || '—'}</Text>,
        },
        {
            icon: <GlobalOutlined />,
            label: 'Langues installées',
            value: <Text>{installedCount}</Text>,
        },
        { icon: <CloudSyncOutlined />, label: 'Sauvegarde', value: backupValue },
        { icon: <ReloadOutlined />, label: 'Mise à jour', value: updateValue },
    ];

    return (
        <Card size="small" variant="borderless">
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {items.map((item) => (
                    <div
                        key={item.label}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Space size="small">
                            <Text type="secondary">{item.icon}</Text>
                            <Text type="secondary">{item.label}</Text>
                        </Space>
                        {item.value}
                    </div>
                ))}
            </Space>
        </Card>
    );
}
