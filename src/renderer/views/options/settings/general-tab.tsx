import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import {
    BookOutlined,
    CheckCircleOutlined,
    CloudSyncOutlined,
    DesktopOutlined,
    GlobalOutlined,
    PauseCircleOutlined,
    ReloadOutlined,
    TranslationOutlined,
} from '@ant-design/icons';
import { MoonIcon, SunIcon } from '@renderer/components/icons';
import type { BackupStatus, InstalledLanguage, UpdaterNotification } from '@shared/types';
import { FontSizeOutlined } from '@ant-design/icons';
import { useAppStore } from '@renderer/stores';
import { useThemeStore, type FontSizeOption } from '@renderer/stores/theme.store';
import {
    UI_LANGUAGE_OPTIONS,
    resolveUiLanguage,
    type UiLanguagePreference,
} from '@shared/constants';
import { DOCS_LINK } from '@renderer/utils/constants';

const { Text } = Typography;

export default function GeneralTab() {
    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [langName, setLangName] = useState('');
    const [installedCount, setInstalledCount] = useState(0);
    const [updateInfo, setUpdateInfo] = useState<UpdaterNotification | null>(null);
    const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);

    const themeMode = useThemeStore((s) => s.themeMode);
    const setThemeMode = useThemeStore((s) => s.setThemeMode);
    const fontSizeOption = useThemeStore((s) => s.fontSizeOption);
    const setFontSizeOption = useThemeStore((s) => s.setFontSizeOption);
    const uiLanguagePreference = useThemeStore((s) => s.uiLanguagePreference);
    const setUiLanguagePreference = useThemeStore((s) => s.setUiLanguagePreference);
    const setUiLanguage = useThemeStore((s) => s.setUiLanguage);

    const handleUiLanguageChange = useCallback(
        (pref: UiLanguagePreference) => {
            setUiLanguagePreference(pref);
            const resolved = resolveUiLanguage(pref === 'auto' ? null : pref, contentLanguage);
            setUiLanguage(resolved);
            window.api.app.setUiLanguage(pref);
        },
        [contentLanguage, setUiLanguagePreference, setUiLanguage],
    );

    const refreshBackup = useCallback(() => {
        window.api.backup.getStatus().then((s) => {
            if (s) setBackupStatus(s);
        });
    }, []);

    useEffect(() => {
        window.api.languages.getInstalled().then((langs: InstalledLanguage[]) => {
            setInstalledCount(langs.length);
            if (contentLanguage) {
                const lang = langs.find((l) => l.code === contentLanguage);
                if (lang) setLangName(lang.language);
            }
        });
        window.api.app.getUpdateStatus().then(setUpdateInfo);
        refreshBackup();
    }, [contentLanguage, refreshBackup]);

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

    const openDocs = useCallback(() => {
        window.api.app.openExternal(DOCS_LINK).catch(() => {
            message.error(t("Impossible d'ouvrir la documentation"));
        });
    }, [t]);

    const backupValue = backupStatus?.active ? (
        <Tag color="green" icon={<CheckCircleOutlined />}>
            {t('Actif')}
        </Tag>
    ) : backupStatus ? (
        <Tag icon={<PauseCircleOutlined />}>{t('En pause')}</Tag>
    ) : (
        <Text type="secondary">{t('Non connecté')}</Text>
    );

    const updateValue =
        updateInfo?.type === 'hasUpdate' ? (
            <Tag color="blue">
                v{updateInfo.updateInfo?.version} {t('disponible')}
            </Tag>
        ) : (
            <Tag color="green" icon={<CheckCircleOutlined />}>
                {t('À jour')}
            </Tag>
        );

    const items: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
        {
            icon: <TranslationOutlined />,
            label: t('Langue des prédications'),
            value: <Text>{langName || '—'}</Text>,
        },
        {
            icon: <GlobalOutlined />,
            label: t('Langues installées'),
            value: <Text>{installedCount}</Text>,
        },
        { icon: <CloudSyncOutlined />, label: t('Sauvegarde'), value: backupValue },
        { icon: <ReloadOutlined />, label: t('Mise à jour'), value: updateValue },
    ];

    const themeOptions = [
        {
            value: 'light',
            icon: <SunIcon style={{ fontSize: 'var(--fs-base)' }} />,
            label: t('Clair'),
        },
        {
            value: 'dark',
            icon: <MoonIcon style={{ fontSize: 'var(--fs-base)' }} />,
            label: t('Sombre'),
        },
        {
            value: 'system',
            icon: <DesktopOutlined style={{ fontSize: 'var(--fs-base)' }} />,
            label: t('Système'),
        },
    ];

    return (
        <Card size="small" variant="borderless">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Theme switcher */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Space size="small">
                        <Text type="secondary">
                            <SunIcon style={{ fontSize: 'var(--fs-base)' }} />
                        </Text>
                        <Text type="secondary">{t('Apparence')}</Text>
                    </Space>
                    <Segmented
                        size="small"
                        value={themeMode}
                        onChange={(val) => setThemeMode(val as 'system' | 'light' | 'dark')}
                        options={themeOptions.map((o) => ({
                            value: o.value,
                            label: (
                                <Space size={4}>
                                    {o.icon}
                                    <span>{o.label}</span>
                                </Space>
                            ),
                        }))}
                    />
                </div>

                {/* Font size */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Space size="small">
                        <Text type="secondary">
                            <FontSizeOutlined />
                        </Text>
                        <Text type="secondary">{t('Taille du texte')}</Text>
                    </Space>
                    <Segmented
                        size="small"
                        value={fontSizeOption}
                        onChange={(val) => setFontSizeOption(val as FontSizeOption)}
                        options={[
                            { value: 'small', label: t('Petit') },
                            { value: 'default', label: t('Normal') },
                            { value: 'large', label: t('Grand') },
                            { value: 'x-large', label: t('Très grand') },
                        ]}
                    />
                </div>

                {/* UI language */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Space orientation="vertical" size={2}>
                        <Space size="small">
                            <Text type="secondary">
                                <TranslationOutlined />
                            </Text>
                            <Text>{t("Langue de l'interface")}</Text>
                        </Space>
                        <Text type="secondary">
                            {t(
                                "Détermine la langue des menus, boutons et messages de l'application.",
                            )}
                        </Text>
                    </Space>
                    <Select
                        size="small"
                        value={uiLanguagePreference}
                        onChange={(val) => handleUiLanguageChange(val as UiLanguagePreference)}
                        options={UI_LANGUAGE_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.value === 'auto' ? t(o.label) : o.label,
                        }))}
                        style={{ width: 140 }}
                    />
                </div>

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
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Space size="small">
                        <Text type="secondary">
                            <BookOutlined />
                        </Text>
                        <Text type="secondary">{t("Documentation d'utilisation")}</Text>
                    </Space>
                    <Button size="small" onClick={openDocs}>
                        {t('Ouvrir')}
                    </Button>
                </div>
            </Space>
        </Card>
    );
}
