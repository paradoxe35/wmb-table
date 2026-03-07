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
        window.api.backup.getReminder().then((canOpen) => canOpen && show());
        return () => {
            cleanup();
            window.removeEventListener('open-backup-modal-from-main', show);
        };
    }, []);

    useEffect(() => {
        updateStatus(window.api.backup.getStatus()).finally(() => setFetchStatus(true));

        const cleanup = window.api.on.backupAccessStatus((status) => {
            // backupAccessStatus provides a boolean, but we need to refetch full status
            if (status) {
                window.api.backup.getStatus().then((s) => {
                    if (s) setActiveBackup(s);
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
            .then((result) => {
                return result ?? null;
            })
            .catch(() => {
                message.error(
                    "Une erreur s'est produite lors de la connexion, réessayez plus tard",
                    7,
                );
                return null;
            })
            .finally(() => setLoading(false));
        updateStatus(pending);
    }, []);

    const handleBackupStatus = useCallback(() => {
        const newActive = activeBackup ? !activeBackup.active : true;
        window.api.backup.toggleStatus(newActive).then(() => {
            window.api.backup.getStatus().then((status) => {
                if (status) setActiveBackup(status);
            });
        });
    }, [activeBackup]);

    return (
        <>
            <Modal
                title={
                    <>
                        <Space orientation="horizontal">
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
        const cleanup = window.api.on.backupProgression((data) => setRestoreProgress(data));
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
            start: <Text>Début de la récupération des données</Text>,
            complete: (
                <Space orientation="vertical">
                    <Text type="success">
                        Vos données ont été restaurées et sauvegardées avec succès. <br />
                        Veuillez fermer et rouvrir l&apos;application ou cliquer sur le bouton
                        ci-dessous pour afficher les modifications apportées.
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
            prepare: <Text>Préparation de la restauration des données</Text>,
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
                Dernière mise à jour: {status.lastUpdate.toLocaleTimeString('fr')}
            </Paragraph>
            {restoreContent && restoreProgress && (
                <Paragraph>
                    <Space orientation="vertical">
                        <Space orientation="horizontal">
                            <Text strong>
                                {restoreProgress.type === 'sauvegarde'
                                    ? 'Sauvegarde'
                                    : 'Restauration'}{' '}
                                de données
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
                        message="L'accès à votre stockage internet est limité, reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront."
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
                Pour activer le système de sauvegarde, vous devez vous connecter à votre compte
                Google.
            </Paragraph>
            <Paragraph strong>
                Après la connexion, vos dernières données sauvegardées seront restaurées
                automatiquement et vos prochaines sauvegardes se feront automatiquement.
            </Paragraph>
        </Typography>
    );
};
