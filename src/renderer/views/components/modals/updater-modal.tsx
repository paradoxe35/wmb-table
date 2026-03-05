import { Alert, Button, Modal, Progress, Space } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalVisible } from '@renderer/hooks';
import { Typography } from 'antd';
import { UpdaterNotification } from '@shared/types';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

type ProgressType = {
    title: string;
    progress: { proceed?: number; total?: number; percent?: number };
    onlyPercent?: boolean;
};

const Icon = () => (
    <Space>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
        <span />
    </Space>
);

const ShowProgress = ({ title, progress, onlyPercent = false }: ProgressType) => {
    const { percent, proceed, total } = progress;
    let rPercent: string | number = 0;
    if (onlyPercent && percent != undefined) {
        rPercent = percent.toFixed(0);
    } else if (proceed != undefined && total != undefined) {
        rPercent = ((proceed * 100) / total).toFixed(0);
    }
    return (
        <Space direction="vertical">
            <Space>
                <Typography.Text strong>{title}</Typography.Text>
                <Icon />
            </Space>
            <div style={{ width: 170 }}>
                <Progress percent={+rPercent} size="small" />
            </div>
        </Space>
    );
};

export default function Updater() {
    const { visible, show, hide } = useModalVisible();

    const [updaterInfo, setUpdaterInfo] = useState<UpdaterNotification | undefined>(undefined);

    useEffect(() => {
        const cleanupNotify = window.api.on.notifyForNewUpdate((info) => {
            setUpdaterInfo(info);
        });

        const cleanupMenu = window.api.on.appUpdateMenu(show);

        return () => {
            cleanupNotify();
            cleanupMenu();
        };
    }, []);

    const start_download_update = useCallback(() => {
        window.api.app.startDownloadUpdate();
    }, []);

    const quit_and_install_update = useCallback(() => {
        window.api.app.quitAndInstallUpdate();
    }, []);

    const lastType = useRef<string | undefined>(undefined);

    useEffect(() => {
        lastType.current = updaterInfo?.type;
    }, [updaterInfo]);

    let preventActions = false;
    let content = <></>;
    let nextStepAction:
        | undefined
        | {
              type: string;
              action: () => void;
          } = undefined;

    switch (updaterInfo?.type) {
        case 'hasUpdate':
            if (lastType.current != 'hasUpdate') {
                if (!visible) show();
            }
            preventActions = false;
            nextStepAction = {
                type: 'Mettre \u00e0 jour',
                action: start_download_update,
            };
            content = (
                <Alert
                    message="Mise \u00e0 jour de l'application"
                    description="Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour d\u00e9marrer le processus de mise \u00e0 jour."
                    type="info"
                    showIcon
                />
            );
            break;
        case 'downloading':
            preventActions = true;
            nextStepAction = undefined;
            content = (
                <>
                    <ShowProgress
                        onlyPercent={true}
                        title="T\u00e9l\u00e9chargement du mise \u00e0 jour"
                        progress={{
                            percent: updaterInfo.progress?.downloadProgress?.percent,
                        }}
                    />
                </>
            );
            break;
        case 'downloaded':
            preventActions = true;
            nextStepAction = {
                type: 'Installer la mise \u00e0 jour',
                action: quit_and_install_update,
            };
            content = (
                <Alert
                    message="T\u00e9l\u00e9chargement termin\u00e9"
                    description="Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise \u00e0 jour."
                    type="success"
                    showIcon
                />
            );
            break;
        case 'error':
            preventActions = false;
            nextStepAction = undefined;
            content = (
                <>
                    <Alert
                        message="Erreur !"
                        description="Une erreur s'est produite lors de la mise \u00e0 jour, veuillez r\u00e9essayer plus tard."
                        type="error"
                        showIcon
                    />
                </>
            );
            break;
        default:
            nextStepAction = undefined;
            preventActions = false;
            content = <></>;
            break;
    }

    return (
        <>
            <Modal
                centered
                closable={!preventActions}
                keyboard={!preventActions}
                maskClosable={!preventActions}
                title={
                    <>
                        <Space direction="horizontal">
                            <span>Mise \u00e0 jour</span>
                        </Space>
                    </>
                }
                open={visible}
                footer={[
                    <Button onClick={hide} disabled={preventActions} key={0}>
                        {updaterInfo?.type === 'hasUpdate' ? 'Plus tard' : 'Fermer'}
                    </Button>,
                    <Button
                        key={1}
                        onClick={nextStepAction?.action}
                        disabled={!nextStepAction}
                        type="primary"
                    >
                        {!nextStepAction ? '---' : nextStepAction.type}
                    </Button>,
                ]}
                onCancel={hide}
            >
                {updaterInfo && (
                    <Space direction="vertical">
                        {updaterInfo.updateInfo?.version && (
                            <Typography>
                                <Typography.Paragraph>
                                    Version: {updaterInfo.updateInfo.version}
                                </Typography.Paragraph>
                            </Typography>
                        )}
                        {content}
                    </Space>
                )}
            </Modal>
        </>
    );
}
