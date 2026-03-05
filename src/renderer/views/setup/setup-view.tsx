import { useCallback, useEffect } from 'react';
import { Button, Card, Checkbox, Progress, Typography, Space, Empty, Spin } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { useSetupStore } from '@renderer/stores';
import { useAppStore } from '@renderer/stores';
import { APP_NAME } from '@renderer/utils/constants';
import type {
    DownloadableLanguage,
    LanguageDownloadProgress,
    InstalledLanguage,
} from '@shared/types';

const { Title, Text, Paragraph } = Typography;

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SetupView() {
    const {
        availableLanguages,
        selectedLanguages,
        downloadingLanguage,
        downloadProgress,
        installedLanguages,
        setAvailableLanguages,
        toggleLanguage,
        setDownloading,
        addInstalled,
    } = useSetupStore();

    const setNeedsSetup = useAppStore((s) => s.setNeedsSetup);
    const setActiveLanguage = useAppStore((s) => s.setActiveLanguage);

    // Load available languages
    useEffect(() => {
        (window.api.languages.getAvailable() as Promise<DownloadableLanguage[]>).then(
            setAvailableLanguages,
        );
    }, []);

    // Listen for download progress and completion
    useEffect(() => {
        const unsub1 = window.api.on.languageDownloadProgress((p: LanguageDownloadProgress) => {
            setDownloading(p.langCode, p.percentage);
        });
        const unsub2 = window.api.on.languageInstalled(({ langCode }: { langCode: string }) => {
            addInstalled(langCode);
        });
        return () => {
            unsub1();
            unsub2();
        };
    }, []);

    const handleInstallSelected = useCallback(async () => {
        const codes = Array.from(selectedLanguages);
        for (const code of codes) {
            setDownloading(code, 0);
            await window.api.languages.install(code);
        }
    }, [selectedLanguages, setDownloading]);

    const handleContinue = useCallback(async () => {
        // Set first installed language as active
        if (installedLanguages.length > 0) {
            const firstLang = installedLanguages[0];
            await window.api.app.setActiveLanguage(firstLang);
            setActiveLanguage(firstLang);
        }
        await window.api.app.initialize();
        setNeedsSetup(false);
    }, [installedLanguages, setNeedsSetup, setActiveLanguage]);

    const canInstall = selectedLanguages.size > 0 && !downloadingLanguage;
    const canContinue = installedLanguages.length > 0 && !downloadingLanguage;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '2rem',
                background: 'var(--bg-color, #f5f5f5)',
            }}
        >
            <div style={{ maxWidth: 700, width: '100%' }}>
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: '100%', textAlign: 'center' }}
                >
                    <GlobalOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                    <Title level={2} style={{ margin: 0 }}>
                        {APP_NAME}
                    </Title>
                    <Paragraph type="secondary">
                        Choisissez les langues que vous souhaitez installer pour commencer.
                    </Paragraph>
                </Space>

                <div style={{ marginTop: '2rem' }}>
                    {availableLanguages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Spin />
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '0.75rem',
                            }}
                        >
                            {availableLanguages.map((lang) => (
                                <LanguageCard
                                    key={lang.code}
                                    lang={lang}
                                    selected={selectedLanguages.has(lang.code)}
                                    installed={installedLanguages.includes(lang.code)}
                                    downloading={downloadingLanguage === lang.code}
                                    progress={
                                        downloadingLanguage === lang.code ? downloadProgress : 0
                                    }
                                    onToggle={() => toggleLanguage(lang.code)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        marginTop: '2rem',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '1rem',
                    }}
                >
                    <Button
                        type="primary"
                        size="large"
                        icon={<DownloadOutlined />}
                        onClick={handleInstallSelected}
                        disabled={!canInstall}
                        loading={!!downloadingLanguage}
                    >
                        {downloadingLanguage ? 'Installation en cours...' : 'Installer'}
                    </Button>
                    <Button
                        type="default"
                        size="large"
                        onClick={handleContinue}
                        disabled={!canContinue}
                    >
                        Continuer
                    </Button>
                </div>

                {installedLanguages.length > 0 && (
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <Text type="success">
                            <CheckCircleOutlined />{' '}
                            {installedLanguages.length === 1
                                ? '1 langue installée'
                                : `${installedLanguages.length} langues installées`}
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
}

function LanguageCard({
    lang,
    selected,
    installed,
    downloading,
    progress,
    onToggle,
}: {
    lang: DownloadableLanguage;
    selected: boolean;
    installed: boolean;
    downloading: boolean;
    progress: number;
    onToggle: () => void;
}) {
    return (
        <Card
            size="small"
            style={{
                cursor: installed ? 'default' : 'pointer',
                border: selected ? '2px solid #1677ff' : undefined,
                opacity: installed ? 0.7 : 1,
            }}
            onClick={installed || downloading ? undefined : onToggle}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {installed ? (
                    <CheckCircleOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                ) : (
                    <Checkbox checked={selected} disabled={downloading} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong>
                        {lang.language}
                        {lang.language !== lang.enLanguage && (
                            <Text type="secondary" style={{ fontWeight: 'normal' }}>
                                {' '}
                                ({lang.enLanguage})
                            </Text>
                        )}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '0.85em' }}>
                        {lang.sermonsAvailable} sermons &middot; {formatSize(lang.filesize)}
                    </Text>
                </div>
            </div>
            {downloading && <Progress percent={progress} size="small" style={{ marginTop: 8 }} />}
        </Card>
    );
}
