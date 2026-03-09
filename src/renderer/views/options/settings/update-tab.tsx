import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Progress, Space, Spin, Typography } from 'antd';
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UpdaterNotification } from '@shared/types';

const { Text } = Typography;

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

    let content = <></>;
    let action: { label: string; onClick: () => void } | null = null;

    switch (info?.type) {
        case 'hasUpdate':
            action = { label: 'Mettre à jour', onClick: startDownload };
            content = (
                <Alert
                    title="Mise à jour de l'application"
                    description="Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour."
                    type="info"
                    showIcon
                />
            );
            break;
        case 'downloading':
            content = (
                <ShowProgress
                    onlyPercent
                    title="Téléchargement de la mise à jour"
                    progress={{ percent: info.progress?.downloadProgress?.percent }}
                />
            );
            break;
        case 'downloaded':
            action = { label: 'Installer la mise à jour', onClick: quitAndInstall };
            content = (
                <Alert
                    title="Téléchargement terminé"
                    description="Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour."
                    type="success"
                    showIcon
                />
            );
            break;
        case 'error':
            content = (
                <Alert
                    title="Erreur !"
                    description="Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard."
                    type="error"
                    showIcon
                />
            );
            break;
        case 'noUpdate':
            content = (
                <Alert
                    title="Aucune mise à jour disponible"
                    description="Vous utilisez déjà la dernière version de l'application."
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
                        <ReloadOutlined /> Mise à jour
                    </Text>
                    <Button size="small" loading={checking} onClick={checkNow}>
                        Vérifier
                    </Button>
                </div>

                {checking ? (
                    <Space>
                        <Text>Vérification des mises à jour...</Text>
                        <SpinIcon />
                    </Space>
                ) : info ? (
                    <>
                        {info.updateInfo?.version && (
                            <Text type="secondary">Version: {info.updateInfo.version}</Text>
                        )}
                        {content}
                        {action && (
                            <Button type="primary" size="small" onClick={action.onClick}>
                                {action.label}
                            </Button>
                        )}
                    </>
                ) : null}
            </Space>
        </Card>
    );
}
