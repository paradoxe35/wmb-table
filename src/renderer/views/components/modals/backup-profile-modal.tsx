import { Button, Modal, Space, message, Progress, Alert } from 'antd';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useModalVisible } from '@renderer/hooks';
import { Typography } from 'antd';
import { BackupStatus, RestoreProgressEvent } from '@shared/types';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export default function BackupProfile() {
    const { visible, show, hide } = useModalVisible();

    const [activeBackup, setActiveBackup] = useState<BackupStatus | undefined>(undefined);

    const [loading, setLoading] = useState<boolean>(false);
    const [fetchedStatus, setFetchStatus] = useState(false);

    useEffect(() => {
        const cleanup = window.api.on.openBackupModalFromMain(show);
        window.addEventListener('open-backup-modal-from-main', show);
        window.api.backup.getReminder().then((canOpen) => (canOpen as boolean) && show());
        return () => {
            cleanup();
            window.removeEventListener('open-backup-modal-from-main', show);
        };
    }, []);

    useEffect(() => {
        updateStatus(window.api.backup.getStatus() as Promise<BackupStatus>).finally(() =>
            setFetchStatus(true),
        );

        const cleanup = window.api.on.backupAccessStatus((status) => {
            // backupAccessStatus provides a boolean, but we need to refetch full status
            if (status) {
                window.api.backup.getStatus().then((s) => {
                    if (s) setActiveBackup(s as BackupStatus);
                });
            }
        });
        return cleanup;
    }, []);

    const updateStatus = useCallback((pendingRequest: Promise<BackupStatus | null | false>) => {
        return pendingRequest.then((status) => {
            if (status && typeof status === 'object') setActiveBackup(status);
        });
    }, []);

    const handleLogin = useCallback(() => {
        setLoading(true);
        const pending = window.api.backup
            .login()
            .then((result: unknown) => {
                return (result as BackupStatus) ?? null;
            })
            .catch(() => {
                message.error(
                    "Une erreur s'est produite lors de la connexion, r\u00e9essayez plus tard",
                    7,
                );
                return null;
            })
            .finally(() => setLoading(false));
        updateStatus(pending as Promise<BackupStatus | null>);
    }, []);

    const handleBackupStatus = useCallback(() => {
        const newActive = activeBackup ? !activeBackup.active : true;
        updateStatus(window.api.backup.toggleStatus(newActive) as Promise<BackupStatus>);
    }, [activeBackup]);

    return (
        <>
            <Modal
                title={
                    <>
                        <Space direction="horizontal">
                            <span>Sauvegarde</span>
                        </Space>
                    </>
                }
                open={visible}
                footer={[
                    <Button key={0} onClick={hide}>
                        {activeBackup ? 'Fermer' : 'Plus tard'}
                    </Button>,
                    <Button
                        key={1}
                        loading={loading}
                        type="primary"
                        onClick={
                            activeBackup && activeBackup.access
                                ? handleBackupStatus
                                : fetchedStatus
                                  ? handleLogin
                                  : undefined
                        }
                    >
                        {activeBackup && activeBackup.access
                            ? activeBackup.active
                                ? 'Pause'
                                : 'Reprendre'
                            : 'Connexion'}
                    </Button>,
                ]}
                onOk={hide}
                onCancel={hide}
            >
                {activeBackup ? <ActiveBackup activeBackup={activeBackup} /> : <BackupContent />}
            </Modal>
        </>
    );
}

const ActiveBackup = ({ activeBackup: status }: { activeBackup: BackupStatus }) => {
    const [restoreProgress, setRestoreProgress] = useState<RestoreProgressEvent>();

    useEffect(() => {
        const cleanup = window.api.on.backupProgression((data) =>
            setRestoreProgress(data as RestoreProgressEvent),
        );
        return cleanup;
    }, []);

    const restartAppNow = useCallback(() => {
        window.api.app.restart();
    }, []);

    const restoreContentType = useMemo(() => {
        if (!restoreProgress) return null;
        const {
            progression: { proceed, total },
        } = restoreProgress;
        const progress = (
            <Text>
                <Space>
                    <span>{restoreProgress.type}: </span>
                    <div style={{ width: 170 }}>
                        <Progress
                            percent={parseInt(((proceed * 100) / total).toFixed(2), 10)}
                            size="small"
                        />
                    </div>
                </Space>
            </Text>
        );
        return {
            start: <Text>D\u00e9but de la r\u00e9cup\u00e9ration des donn\u00e9es</Text>,
            complete: (
                <Space direction="vertical">
                    <Text type="success">
                        Vos donn\u00e9es ont \u00e9t\u00e9 restaur\u00e9es et sauvegard\u00e9es avec
                        succ\u00e8s. <br />
                        Veuillez fermer et rouvrir l&apos;application ou cliquer sur le bouton
                        ci-dessous pour afficher les modifications apport\u00e9es.
                    </Text>
                    <Button onClick={restartAppNow}>
                        Redémarrer l&apos;application maintenant
                    </Button>
                </Space>
            ),
            error: (
                <Text type="danger">
                    Une erreur s&apos;est produite lors de la restauration, veuillez réessayer plus
                    tard
                </Text>
            ),
            prepare: <Text>Pr\u00e9paration de la restauration des donn\u00e9es</Text>,
            progress: progress,
            sauvegarde: progress,
        } as { [x: string]: ReactElement };
    }, [restoreProgress]);

    const restoreContent = useMemo(() => {
        if (!restoreContentType || !restoreProgress) return null;
        for (const key in restoreContentType) {
            if (restoreProgress.type.includes(key)) {
                return restoreContentType[key];
            }
        }
        return null;
    }, [restoreContentType]);

    return (
        <Typography>
            <Paragraph>Email: {status.email}</Paragraph>
            <Paragraph>Stockage: {'Google Drive'}</Paragraph>
            <Paragraph>
                Derni\u00e8re mise \u00e0 jour: {status.lastUpdate.toLocaleTimeString('fr')}
            </Paragraph>
            {restoreContent && restoreProgress && (
                <Paragraph>
                    <Space direction="vertical">
                        <Space direction="horizontal">
                            <Text strong>
                                {restoreProgress.type === 'sauvegarde'
                                    ? 'Sauvegarde'
                                    : 'Restauration'}{' '}
                                de donn\u00e9es
                            </Text>
                            {['start', 'prepare', 'progress', 'sauvegarde'].some((type) =>
                                restoreProgress.type.includes(type),
                            ) && (
                                <Spin
                                    indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />}
                                />
                            )}
                        </Space>
                        {restoreContent}
                    </Space>
                </Paragraph>
            )}

            {!status.access && (
                <Paragraph>
                    <Alert
                        message="l'acc\u00e8s \u00e0 votre stockage internet est limit\u00e9, reconnectez-vous et assurez-vous d'avoir autoris\u00e9 l'acc\u00e8s demand\u00e9 en cochant les cases qui s'afficheront."
                        type="error"
                    />
                </Paragraph>
            )}
        </Typography>
    );
};

const BackupContent = () => {
    return (
        <Typography>
            <Paragraph>
                Pour activer le syst\u00e8me de sauvegarde, vous devez vous connecter \u00e0 votre
                compte Google.
            </Paragraph>
            <Paragraph strong>
                Apr\u00e8s la connexion, vos derni\u00e8res donn\u00e9es sauvegard\u00e9es seront
                restaur\u00e9es automatiquement et vos prochaines sauvegardes se feront
                automatiquement.
            </Paragraph>
        </Typography>
    );
};
