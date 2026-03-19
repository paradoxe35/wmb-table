import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Tabs, Typography } from 'antd';
import {
    CloudSyncOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    ReadOutlined,
    ReloadOutlined,
    CommentOutlined,
    SettingOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { UPDATE_TAB_EVENT } from '@renderer/components/update-notifier';
import GeneralTab from './general-tab';
import LanguagesTab from './languages-tab';
import BackupTab from './backup-tab';
import UpdateTab from './update-tab';
import TtsTab from './tts-tab';
import DocumentViewTab from './document-view-tab';
import AiTab from './ai-tab';

const { Title, Text } = Typography;

const TAB_KEYS = {
    general: 'general',
    documentView: 'documentView',
    languages: 'languages',
    tts: 'tts',
    ai: 'ai',
    backup: 'backup',
    update: 'update',
} as const;

export default function Settings() {
    const { t } = useTranslation();
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

    useEffect(() => {
        const handler = () => setActiveTab(TAB_KEYS.update);
        window.addEventListener(UPDATE_TAB_EVENT, handler);
        return () => window.removeEventListener(UPDATE_TAB_EVENT, handler);
    }, []);

    const onTabChange = useCallback((key: string) => setActiveTab(key), []);

    const tabItems = useMemo(
        () => [
            {
                key: TAB_KEYS.general,
                label: (
                    <span>
                        <InfoCircleOutlined /> {t('Général')}
                    </span>
                ),
                children: <GeneralTab />,
            },
            {
                key: TAB_KEYS.documentView,
                label: (
                    <span>
                        <ReadOutlined /> {t('Vue document')}
                    </span>
                ),
                children: <DocumentViewTab />,
            },
            {
                key: TAB_KEYS.languages,
                label: (
                    <span>
                        <GlobalOutlined /> {t('Prédications')}
                    </span>
                ),
                children: <LanguagesTab />,
            },
            {
                key: TAB_KEYS.tts,
                label: (
                    <span>
                        <SoundOutlined /> {t('Lecture audio')}
                    </span>
                ),
                children: <TtsTab />,
            },
            {
                key: TAB_KEYS.ai,
                label: (
                    <span>
                        <CommentOutlined /> {t('Assistant')}
                    </span>
                ),
                children: <AiTab />,
            },
            {
                key: TAB_KEYS.backup,
                label: (
                    <span>
                        <CloudSyncOutlined /> {t('Sauvegarde')}
                    </span>
                ),
                children: <BackupTab />,
            },
            {
                key: TAB_KEYS.update,
                label: (
                    <span>
                        <ReloadOutlined /> {t('Mise à jour')}
                    </span>
                ),
                children: <UpdateTab />,
            },
        ],
        [t],
    );

    return (
        <div
            style={{ padding: '16px 12px', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <SettingOutlined style={{ fontSize: 'var(--fs-2xl)' }} />
                <Title level={5} style={{ margin: 0 }}>
                    {t('Paramètres')}
                </Title>
            </div>
            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                {t('Gérez les préférences de votre application.')}
            </Text>
            <Divider style={{ margin: '12px 0' }} />
            <Tabs items={tabItems} activeKey={activeTab} onChange={onTabChange} />
        </div>
    );
}
