import { useCallback, useEffect, useMemo, useState } from 'react';
import { Divider, Tabs, Typography } from 'antd';
import {
    CloudSyncOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    SettingOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import GeneralTab from './general-tab';
import LanguagesTab from './languages-tab';
import BackupTab from './backup-tab';
import UpdateTab from './update-tab';
import TtsTab from './tts-tab';

const { Title, Text } = Typography;

const TAB_KEYS = {
    general: 'general',
    languages: 'languages',
    tts: 'tts',
    backup: 'backup',
    update: 'update',
} as const;

export default function Settings() {
    const showOptions = useAppStore((s) => s.showOptions);
    const [activeTab, setActiveTab] = useState<string>(TAB_KEYS.general);

    useEffect(() => {
        return window.api.on.openSettings(() => {
            showOptions('settings');
        });
    }, [showOptions]);

    useEffect(() => {
        const goToBackup = () => {
            showOptions('settings');
            setActiveTab(TAB_KEYS.backup);
        };
        const cleanupIpc = window.api.on.openBackupModalFromMain(goToBackup);
        window.addEventListener('open-backup-modal-from-main', goToBackup);
        window.api.backup.getReminder().then((canOpen) => canOpen && goToBackup());
        return () => {
            cleanupIpc();
            window.removeEventListener('open-backup-modal-from-main', goToBackup);
        };
    }, [showOptions]);

    useEffect(() => {
        return window.api.on.appUpdateMenu(() => {
            showOptions('settings');
            setActiveTab(TAB_KEYS.update);
        });
    }, [showOptions]);

    const onTabChange = useCallback((key: string) => setActiveTab(key), []);

    const tabItems = useMemo(
        () => [
            {
                key: TAB_KEYS.general,
                label: (
                    <span>
                        <InfoCircleOutlined /> Général
                    </span>
                ),
                children: <GeneralTab />,
            },
            {
                key: TAB_KEYS.languages,
                label: (
                    <span>
                        <GlobalOutlined /> Langues
                    </span>
                ),
                children: <LanguagesTab />,
            },
            {
                key: TAB_KEYS.tts,
                label: (
                    <span>
                        <SoundOutlined /> Lecture audio
                    </span>
                ),
                children: <TtsTab />,
            },
            {
                key: TAB_KEYS.backup,
                label: (
                    <span>
                        <CloudSyncOutlined /> Sauvegarde
                    </span>
                ),
                children: <BackupTab />,
            },
            {
                key: TAB_KEYS.update,
                label: (
                    <span>
                        <ReloadOutlined /> Mise à jour
                    </span>
                ),
                children: <UpdateTab />,
            },
        ],
        [],
    );

    return (
        <div style={{ padding: '16px 12px', maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <SettingOutlined style={{ fontSize: 18 }} />
                <Title level={5} style={{ margin: 0 }}>
                    Paramètres
                </Title>
            </div>
            <Text type="secondary" style={{ fontSize: '0.85em' }}>
                Gérez les préférences de votre application.
            </Text>
            <Divider style={{ margin: '12px 0' }} />
            <Tabs items={tabItems} activeKey={activeTab} onChange={onTabChange} />
        </div>
    );
}
