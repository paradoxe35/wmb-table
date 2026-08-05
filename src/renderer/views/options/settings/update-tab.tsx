import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Progress, Space, Spin, Typography } from 'antd';
import {
    CloudDownloadOutlined,
    DownloadOutlined,
    LoadingOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import type { UpdaterNotification } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { buildDownloadPageLink } from '@shared/constants';
import { formatBytes } from './tts-shared';

const { Text } = Typography;

const SpinIcon = () => (
    <Spin indicator={<LoadingOutlined style={{ fontSize: 'var(--fs-3xl)' }} spin />} />
);

export default function UpdateTab() {
    const { t } = useTranslation();
    const [info, setInfo] = useState<UpdaterNotification | undefined>(undefined);
    /** Which action is waiting on the main process to answer */
    const [pending, setPending] = useState<'check' | 'download' | null>(null);
    /** Last action the user triggered, so a retry repeats the right one */
    const lastActionRef = useRef<'check' | 'download'>('check');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const apply = useCallback((next: UpdaterNotification) => {
        if (!mountedRef.current) return;
        setInfo(next);
        setPending(null);
    }, []);

    useEffect(() => {
        window.api.app.getUpdateStatus().then((status) => {
            if (mountedRef.current) setInfo(status);
        });
        return window.api.on.notifyForNewUpdate((data) => {
            if (!mountedRef.current) return;
            setInfo(data);
            if (data.type !== 'checking') setPending(null);
        });
    }, []);

    const checkNow = useCallback(() => {
        lastActionRef.current = 'check';
        setPending('check');
        window.api.app.checkForUpdates().then(apply, () => setPending(null));
    }, [apply]);

    const startDownload = useCallback(() => {
        lastActionRef.current = 'download';
        setPending('download');
        window.api.app.startDownloadUpdate().then(apply, () => setPending(null));
    }, [apply]);

    const retry = useCallback(() => {
        if (lastActionRef.current === 'download') startDownload();
        else checkNow();
    }, [checkNow, startDownload]);

    const quitAndInstall = useCallback(() => {
        window.api.app.quitAndInstallUpdate();
    }, []);

    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const openDownloadPage = useCallback(() => {
        window.api.app.openExternal(buildDownloadPageLink(contentLanguage));
    }, [contentLanguage]);

    const canAuto = info?.canAutoUpdate !== false;
    const updaterEnabled = info?.updaterEnabled !== false;
    // `pending` covers the IPC round-trip; the main process drives the rest
    const isDownloading = info?.type === 'downloading' || pending === 'download';
    const checking = !isDownloading && (pending === 'check' || info?.type === 'checking');
    const status = isDownloading ? 'downloading' : info?.type;

    let content: React.ReactNode = null;
    let action: { label: string; onClick: () => void; icon?: React.ReactNode } | null = null;

    if (!updaterEnabled) {
        content = (
            <Alert
                title={t('Mise à jour automatique indisponible')}
                description={t(
                    "Les mises à jour automatiques sont disponibles uniquement dans l'application installée.",
                )}
                type="info"
                showIcon
            />
        );
    } else if (!canAuto) {
        // electron-updater declines to check here, so no update state ever arrives
        action = {
            label: t('Télécharger depuis le site'),
            onClick: openDownloadPage,
            icon: <DownloadOutlined />,
        };
        content = (
            <Alert
                title={t('Mise à jour automatique indisponible')}
                description={t(
                    "La mise à jour automatique n'est pas prise en charge pour votre type d'installation. Veuillez télécharger la dernière version depuis le site.",
                )}
                type="info"
                showIcon
            />
        );
    } else {
        switch (status) {
            case 'hasUpdate':
                action = {
                    label: t('Mettre à jour'),
                    onClick: startDownload,
                    icon: <CloudDownloadOutlined />,
                };
                content = (
                    <Alert
                        title={t("Mise à jour de l'application")}
                        description={t(
                            'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.',
                        )}
                        type="info"
                        showIcon
                    />
                );
                break;
            case 'downloading': {
                const progress = info?.progress?.downloadProgress;
                const started = !!progress?.total;
                const percent = started ? Math.min(100, Math.round(progress.percent)) : 0;
                content = (
                    <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                        <Space>
                            <Text strong>
                                {started
                                    ? t('Téléchargement de la mise à jour')
                                    : t('Préparation du téléchargement...')}
                            </Text>
                            <SpinIcon />
                        </Space>
                        <div style={{ width: '100%', maxWidth: 320 }}>
                            <Progress
                                percent={percent}
                                size="small"
                                status="active"
                                showInfo={started}
                            />
                        </div>
                        {started && (
                            <Text type="secondary">
                                {formatBytes(progress.transferred, t)} /{' '}
                                {formatBytes(progress.total, t)}
                                {progress.bytesPerSecond > 0 &&
                                    ` · ${formatBytes(progress.bytesPerSecond, t)}/s`}
                            </Text>
                        )}
                    </Space>
                );
                break;
            }
            case 'downloaded':
                action = {
                    label: t('Installer la mise à jour'),
                    onClick: quitAndInstall,
                    icon: <ReloadOutlined />,
                };
                content = (
                    <Alert
                        title={t('Téléchargement terminé')}
                        description={
                            <>
                                {t(
                                    "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.",
                                )}
                                {info?.requiresElevatedInstall && (
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
                                            {t(
                                                "Votre mot de passe administrateur sera demandé pour terminer l'installation.",
                                            )}
                                        </Text>
                                    </div>
                                )}
                            </>
                        }
                        type="success"
                        showIcon
                    />
                );
                break;
            case 'error':
                action = { label: t('Réessayer'), onClick: retry, icon: <ReloadOutlined /> };
                content = (
                    <Alert
                        title={t('Erreur !')}
                        description={
                            <>
                                {t(
                                    "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.",
                                )}
                                {info?.message && (
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
                                            {info.message}
                                        </Text>
                                    </div>
                                )}
                            </>
                        }
                        type="error"
                        showIcon
                    />
                );
                break;
            case 'noUpdate':
                content = (
                    <Alert
                        title={t('Aucune mise à jour disponible')}
                        description={t("Vous utilisez déjà la dernière version de l'application.")}
                        type="info"
                        showIcon
                    />
                );
                break;
            case 'none':
            case 'checking':
            default:
                content = (
                    <Alert
                        title={t('Aucune vérification effectuée')}
                        description={t('Vérifiez si une nouvelle version est disponible.')}
                        type="info"
                        showIcon
                    />
                );
                break;
        }
    }

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
                        <ReloadOutlined /> {t('Mise à jour')}
                    </Text>
                    <Button
                        size="small"
                        loading={checking}
                        disabled={!updaterEnabled || !canAuto || isDownloading}
                        onClick={checkNow}
                    >
                        {t('Vérifier')}
                    </Button>
                </div>

                {info?.currentVersion && (
                    <Text type="secondary">
                        {t('Version actuelle')}: {info.currentVersion}
                    </Text>
                )}
                {info?.updateInfo?.version && info.updateInfo.version !== info.currentVersion && (
                    <Text type="secondary">
                        {t('Nouvelle version')}: {info.updateInfo.version}
                    </Text>
                )}

                {checking ? (
                    <Space>
                        <Text>{t('Vérification des mises à jour...')}</Text>
                        <SpinIcon />
                    </Space>
                ) : (
                    <>
                        {content}
                        {action && (
                            <Button
                                type="primary"
                                size="small"
                                icon={action.icon}
                                loading={pending !== null}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </Button>
                        )}
                    </>
                )}
            </Space>
        </Card>
    );
}
