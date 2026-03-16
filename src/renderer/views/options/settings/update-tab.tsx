import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Progress, Space, Spin, Typography } from 'antd';
import { DownloadOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UpdaterNotification } from '@shared/types';

const { Text } = Typography;

const DOWNLOAD_PAGE = 'https://wmb-table.web.app/#download';

type ProgressType = {
    title: string;
    progress: { proceed?: number; total?: number; percent?: number };
    onlyPercent?: boolean;
};

const SpinIcon = () => <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />;

const ShowProgress = ({ title, progress, onlyPercent = false }: ProgressType) => {
    const { percent, proceed, total } = progress;
    let rPercent: string | number = 0;
    if (onlyPercent && percent != undefined) {
        rPercent = percent.toFixed(0);
    } else if (proceed != undefined && total != undefined) {
        rPercent = ((proceed * 100) / total).toFixed(0);
    }
    return (
        <Space orientation="vertical">
            <Space>
                <Text strong>{title}</Text>
                <SpinIcon />
            </Space>
            <div style={{ width: 170 }}>
                <Progress percent={+rPercent} size="small" />
            </div>
        </Space>
    );
};

export default function UpdateTab() {
    const { t } = useTranslation();
    const [info, setInfo] = useState<UpdaterNotification | undefined>(undefined);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        window.api.app.getUpdateStatus().then(setInfo);
        return window.api.on.notifyForNewUpdate((data) => {
            setChecking(false);
            setInfo(data);
        });
    }, []);

    const checkNow = useCallback(() => {
        setChecking(true);
        window.api.app.checkForUpdates();
        setTimeout(
            () =>
                setChecking((c) => {
                    if (c) setInfo({ type: 'noUpdate' } as UpdaterNotification);
                    return false;
                }),
            10_000,
        );
    }, []);

    const startDownload = useCallback(() => {
        window.api.app.startDownloadUpdate();
    }, []);

    const quitAndInstall = useCallback(() => {
        window.api.app.quitAndInstallUpdate();
    }, []);

    const openDownloadPage = useCallback(() => {
        window.api.app.openExternal(DOWNLOAD_PAGE);
    }, []);

    const canAuto = info?.canAutoUpdate !== false;

    let content = <></>;
    let action: { label: string; onClick: () => void; icon?: React.ReactNode } | null = null;

    switch (info?.type) {
        case 'hasUpdate':
            if (canAuto) {
                action = { label: t('Mettre à jour'), onClick: startDownload };
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
            } else {
                action = {
                    label: t('Télécharger depuis le site'),
                    onClick: openDownloadPage,
                    icon: <DownloadOutlined />,
                };
                content = (
                    <Alert
                        title={t("Mise à jour de l'application")}
                        description={t(
                            "La version {{version}} est disponible. La mise à jour automatique n'est pas prise en charge pour votre type d'installation. Veuillez télécharger la nouvelle version depuis le site.",
                            { version: info.updateInfo?.version ?? '' },
                        )}
                        type="info"
                        showIcon
                    />
                );
            }
            break;
        case 'downloading':
            content = (
                <ShowProgress
                    onlyPercent
                    title={t('Téléchargement de la mise à jour')}
                    progress={{ percent: info.progress?.downloadProgress?.percent }}
                />
            );
            break;
        case 'downloaded':
            action = { label: t('Installer la mise à jour'), onClick: quitAndInstall };
            content = (
                <Alert
                    title={t('Téléchargement terminé')}
                    description={t(
                        "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.",
                    )}
                    type="success"
                    showIcon
                />
            );
            break;
        case 'error':
            content = (
                <Alert
                    title={t('Erreur !')}
                    description={t(
                        "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.",
                    )}
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
                    <Button size="small" loading={checking} onClick={checkNow}>
                        {t('Vérifier')}
                    </Button>
                </div>

                {checking ? (
                    <Space>
                        <Text>{t('Vérification des mises à jour...')}</Text>
                        <SpinIcon />
                    </Space>
                ) : info ? (
                    <>
                        {info.updateInfo?.version && (
                            <Text type="secondary">Version: {info.updateInfo.version}</Text>
                        )}
                        {content}
                        {action && (
                            <Button
                                type="primary"
                                size="small"
                                icon={action.icon}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </Button>
                        )}
                    </>
                ) : null}
            </Space>
        </Card>
    );
}
