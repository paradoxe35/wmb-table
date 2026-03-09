import { useCallback, useEffect, useState } from 'react';
import { Alert, Avatar, Button, Card, Progress, Space, Spin, Switch, Tag, Typography } from 'antd';
import {
    CheckCircleOutlined,
    CloudOutlined,
    LoadingOutlined,
    LoginOutlined,
    PauseCircleOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import type { BackupStatus, RestoreProgressEvent, RestoreProgressEventType } from '@shared/types';

const { Text, Paragraph } = Typography;

export default function BackupTab() {
    const [status, setStatus] = useState<BackupStatus | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [fetchedStatus, setFetchedStatus] = useState(false);

    useEffect(() => {
        window.api.backup
            .getStatus()
            .then((s) => {
                if (s && typeof s === 'object') setStatus(s);
            })
            .finally(() => setFetchedStatus(true));

        const cleanup = window.api.on.backupAccessStatus((hasAccess) => {
            if (hasAccess) {
                window.api.backup.getStatus().then((s) => {
                    if (s) setStatus(s);
                });
            }
        });
        return cleanup;
    }, []);

    const handleLogin = useCallback(() => {
        setLoading(true);
        window.api.backup
            .login()
            .then((result) => {
                if (result && typeof result === 'object') setStatus(result);
            })
            .catch(() => {
                message.error(
                    "Une erreur s'est produite lors de la connexion, réessayez plus tard",
                    7,
                );
            })
            .finally(() => setLoading(false));
    }, []);

    const handleToggleStatus = useCallback(() => {
        const newActive = status ? !status.active : true;
        window.api.backup.toggleStatus(newActive).then(() => {
            window.api.backup.getStatus().then((s) => {
                if (s) setStatus(s);
            });
        });
    }, [status]);

    if (!fetchedStatus) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined spin />} />
            </div>
        );
    }

    if (!status) {
        return (
            <Card variant="borderless">
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 0',
                    }}
                >
                    <Avatar size={48} icon={<CloudOutlined />} style={{ background: '#1677ff' }} />
                    <div style={{ textAlign: 'center' }}>
                        <Paragraph style={{ marginBottom: 4 }}>
                            Connectez-vous avec Google pour sauvegarder vos données sur Google
                            Drive.
                        </Paragraph>
                        <Paragraph type="secondary" style={{ fontSize: '0.85em', marginBottom: 0 }}>
                            Vos données seront restaurées automatiquement lors de la connexion.
                        </Paragraph>
                    </div>
                    <Button
                        type="primary"
                        icon={<LoginOutlined />}
                        loading={loading}
                        onClick={handleLogin}
                    >
                        Connexion Google
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Profile card */}
            <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar
                        size={40}
                        icon={<UserOutlined />}
                        style={{ background: '#1677ff', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block' }}>
                            {status.name || status.email}
                        </Text>
                        {status.name && (
                            <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                {status.email}
                            </Text>
                        )}
                    </div>
                    {status.active ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                            Actif
                        </Tag>
                    ) : (
                        <Tag icon={<PauseCircleOutlined />}>En pause</Tag>
                    )}
                </div>
            </Card>

            {/* Sync settings */}
            <Card size="small">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        <Text style={{ display: 'block' }}>Synchronisation automatique</Text>
                        <Text type="secondary" style={{ fontSize: '0.85em' }}>
                            Google Drive
                        </Text>
                    </div>
                    <Switch checked={status.active} onChange={handleToggleStatus} />
                </div>
                {status.lastUpdate && (
                    <Text
                        type="secondary"
                        style={{ fontSize: '0.8em', display: 'block', marginTop: 8 }}
                    >
                        Dernière synchronisation : {status.lastUpdate.toLocaleTimeString('fr')}
                    </Text>
                )}
            </Card>

            {/* Access warning */}
            {!status.access && (
                <Alert
                    title="Accès limité"
                    description="Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront."
                    type="error"
                    showIcon
                />
            )}

            {/* Restore progress */}
            <RestoreProgress status={status} onStatusRefresh={setStatus} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Restore / sync progress
// ---------------------------------------------------------------------------

function RestoreProgress({
    onStatusRefresh,
}: {
    status: BackupStatus;
    onStatusRefresh: (s: BackupStatus) => void;
}) {
    const [restoreProgress, setRestoreProgress] = useState<RestoreProgressEvent>();

    useEffect(() => {
        return window.api.on.backupProgression((data) => setRestoreProgress(data));
    }, []);

    useEffect(() => {
        const handler = () => {
            window.api.backup.getStatus().then((s) => {
                if (s) onStatusRefresh(s);
            });
        };
        window.addEventListener('sync-completed', handler);
        return () => window.removeEventListener('sync-completed', handler);
    }, [onStatusRefresh]);

    const restartAppNow = useCallback(() => {
        window.api.app.restart();
    }, []);

    if (!restoreProgress) return null;

    const isInProgress = !['complete', 'error'].some((t) => restoreProgress.type.includes(t));

    const renderContent = (type: RestoreProgressEventType, proceed: number, total: number) => {
        if (type === 'start') return <Text>Début de la récupération des données</Text>;
        if (type === 'prepare') return <Text>Préparation de la restauration des données</Text>;
        if (type === 'error') {
            return (
                <Text type="danger">
                    Une erreur s&apos;est produite lors de la restauration, veuillez réessayer plus
                    tard
                </Text>
            );
        }
        if (type === 'complete') {
            return (
                <Space direction="vertical" size="small">
                    <Text type="success">Vos données ont été restaurées avec succès.</Text>
                    <Button size="small" onClick={restartAppNow}>
                        Redémarrer l&apos;application
                    </Button>
                </Space>
            );
        }
        const percent = total > 0 ? parseInt(((proceed * 100) / total).toFixed(2), 10) : 0;
        return (
            <div style={{ width: 200 }}>
                <Progress percent={percent} size="small" />
            </div>
        );
    };

    return (
        <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Space>
                    <Text strong>
                        {restoreProgress.type === 'sauvegarde' ? 'Sauvegarde' : 'Restauration'} de
                        données
                    </Text>
                    {isInProgress && (
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                    )}
                </Space>
                {renderContent(
                    restoreProgress.type,
                    restoreProgress.progression.proceed,
                    restoreProgress.progression.total,
                )}
            </Space>
        </Card>
    );
}
