import { useCallback, useEffect, useMemo } from 'react';
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
import { Badge } from 'antd';
import {
    useAppStore,
    useInstalledLanguagesStore,
    selectHasLanguageUpdates,
} from '@renderer/stores';
import { SETTINGS_TAB_KEYS, type SettingsTabValue } from '@renderer/stores/app.store';
import { UPDATE_TAB_EVENT } from '@renderer/components/update-notifier';
import GeneralTab from './general-tab';
import LibraryTab from './library-tab';
import BackupTab from './backup-tab';
import UpdateTab from './update-tab';
import TtsTab from './tts-tab';
import DocumentViewTab from './document-view-tab';
import AiTab from './ai-tab';

const { Title, Text } = Typography;

function LibraryTabLabel() {
    const { t } = useTranslation();
    const hasUpdates = useInstalledLanguagesStore(selectHasLanguageUpdates);
    return (
        <Badge
            dot={hasUpdates}
            title={hasUpdates ? t('Mise à jour disponible') : undefined}
            offset={[6, 2]}
        >
            <span>
                <GlobalOutlined /> {t('Bibliothèque')}
            </span>
        </Badge>
    );
}

export default function Settings() {
    const { t } = useTranslation();
    const showOptions = useAppStore((s) => s.showOptions);
    const activeTab = useAppStore((s) => s.settingsTab);
    const setSettingsTab = useAppStore((s) => s.setSettingsTab);

    useEffect(() => {
        return window.api.on.openSettings(() => {
            showOptions('settings');
        });
    }, [showOptions]);

    useEffect(() => {
        return window.api.on.appUpdateMenu(() => {
            showOptions('settings');
            setSettingsTab(SETTINGS_TAB_KEYS.update);
        });
    }, [setSettingsTab, showOptions]);

    useEffect(() => {
        const handler = () => setSettingsTab(SETTINGS_TAB_KEYS.update);
        window.addEventListener(UPDATE_TAB_EVENT, handler);
        return () => window.removeEventListener(UPDATE_TAB_EVENT, handler);
    }, [setSettingsTab]);

    const onTabChange = useCallback(
        (key: string) => setSettingsTab(key as SettingsTabValue),
        [setSettingsTab],
    );

    const tabItems = useMemo(
        () => [
            {
                key: SETTINGS_TAB_KEYS.general,
                label: (
                    <span>
                        <InfoCircleOutlined /> {t('Général')}
                    </span>
                ),
                children: <GeneralTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.documentView,
                label: (
                    <span>
                        <ReadOutlined /> {t('Vue document')}
                    </span>
                ),
                children: <DocumentViewTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.languages,
                label: <LibraryTabLabel />,
                children: <LibraryTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.tts,
                label: (
                    <span>
                        <SoundOutlined /> {t('Lecture audio')}
                    </span>
                ),
                children: <TtsTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.ai,
                label: (
                    <span>
                        <CommentOutlined /> {t('Assistant')}
                    </span>
                ),
                children: <AiTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.backup,
                label: (
                    <span>
                        <CloudSyncOutlined /> {t('Sauvegarde')}
                    </span>
                ),
                children: <BackupTab />,
            },
            {
                key: SETTINGS_TAB_KEYS.update,
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
            className="settings-page"
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
            <Tabs
                className="settings-page__tabs"
                items={tabItems}
                activeKey={activeTab}
                onChange={onTabChange}
            />
        </div>
    );
}
