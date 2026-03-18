import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Avatar,
    Button,
    Card,
    Popconfirm,
    Progress,
    Space,
    Spin,
    Switch,
    Tag,
    Typography,
} from 'antd';
import {
    CheckCircleOutlined,
    CloudOutlined,
    LoadingOutlined,
    LoginOutlined,
    LogoutOutlined,
    PauseCircleOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import type { BackupStatus, RestoreProgressEvent, RestoreProgressEventType } from '@shared/types';
import { useAppStore } from '@renderer/stores';
import { SYNC_EVENT } from '@renderer/utils/events';

const { Text, Paragraph } = Typography;

export default function BackupTab() {
    const { t } = useTranslation();
    const [status, setStatus] = useState<BackupStatus | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [fetchedStatus, setFetchedStatus] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        window.api.backup
            .getStatus()
            .then((s) => {
                if (s && typeof s === 'object') setStatus(s);
            })
            .finally(() => setFetchedStatus(true));

        // Fetch initial sync status for error display
        window.api.sync.getStatus().then((s) => {
            if (s.error) setSyncError(s.error);
        });

        const cleanup = window.api.on.backupAccessStatus((hasAccess) => {
            if (hasAccess) {
                window.api.backup.getStatus().then((s) => {
                    if (s) setStatus(s);
                });
            }
        });

        // Clear error on successful sync
        const onSyncCompleted = () => setSyncError(null);
        window.addEventListener(SYNC_EVENT.syncCompleted, onSyncCompleted);

        // Show error on sync failure
        const cleanupFailure = window.api.on.syncFailure((event) => {
            setSyncError(event.message);
        });

        return () => {
            cleanup();
            cleanupFailure();
            window.removeEventListener(SYNC_EVENT.syncCompleted, onSyncCompleted);
        };
    }, []);

    const setSyncing = useAppStore((s) => s.setSyncing);

    const handleLogin = useCallback(() => {
        setLoading(true);
        window.api.backup
            .login()
            .then((result) => {
                if (result && typeof result === 'object') setStatus(result);
                setSyncing(true);
                message.success(t('Connexion réussie. Synchronisation en arrière-plan...'), 3);
            })
            .catch(() => {
                message.error(
                    t("Une erreur s'est produite lors de la connexion, réessayez plus tard"),
                    7,
                );
            })
            .finally(() => setLoading(false));
    }, [setSyncing]);

    const handleToggleStatus = useCallback(() => {
        const newActive = status ? !status.active : true;
        window.api.backup.toggleStatus(newActive).then(() => {
            window.api.backup.getStatus().then((s) => {
                if (s) setStatus(s);
            });
            if (newActive) {
                message.info(t('Synchronisation activée'));
            }
        });
    }, [status]);

    const handleLogout = useCallback(() => {
        setLoading(true);
        window.api.backup
            .logout()
            .then(() => {
                setStatus(undefined);
                setSyncing(false);
                setSyncError(null);
                message.success(t('Déconnexion réussie'));
            })
            .catch(() => {
                message.error(
                    t("Une erreur s'est produite lors de la déconnexion, réessayez plus tard"),
                );
            })
            .finally(() => setLoading(false));
    }, [setSyncing]);

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
                    <Avatar
                        size={48}
                        icon={<CloudOutlined />}
                        style={{ background: 'var(--ant-color-primary)' }}
                    />
                    <div style={{ textAlign: 'center' }}>
                        <Paragraph style={{ marginBottom: 4 }}>
                            {t(
                                'Connectez-vous avec Google pour sauvegarder vos données sur Google Drive.',
                            )}
                        </Paragraph>
                        <Paragraph
                            type="secondary"
                            style={{ fontSize: 'var(--fs-rel-xl)', marginBottom: 0 }}
                        >
                            {t(
                                'Vos données seront restaurées automatiquement lors de la connexion.',
                            )}
                        </Paragraph>
                    </div>
                    <Button
                        type="primary"
                        icon={<LoginOutlined />}
                        loading={loading}
                        onClick={handleLogin}
                    >
                        {t('Connexion Google')}
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
                        style={{ background: 'var(--ant-color-primary)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block' }}>
                            {status.name || status.email}
                        </Text>
                        {status.name && (
                            <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                                {status.email}
                            </Text>
                        )}
                    </div>
                    {status.active ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                            {t('Actif')}
                        </Tag>
                    ) : (
                        <Tag icon={<PauseCircleOutlined />}>{t('En pause')}</Tag>
                    )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <Popconfirm
                        title={t('Se déconnecter de Google ?')}
                        description={
                            <>
                                {t(
                                    'La synchronisation sera arrêtée et les données de connexion supprimées.',
                                )}
                                <br />
                                {t('Vos données locales seront conservées.')}
                            </>
                        }
                        onConfirm={handleLogout}
                        okText={t('Oui')}
                        cancelText={t('Annuler')}
                    >
                        <Button danger size="small" icon={<LogoutOutlined />} loading={loading}>
                            {t('Déconnexion')}
                        </Button>
                    </Popconfirm>
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
                        <Text style={{ display: 'block' }}>{t('Synchronisation automatique')}</Text>
                        <Text type="secondary" style={{ fontSize: 'var(--fs-rel-xl)' }}>
                            Google Drive
                        </Text>
                    </div>
                    <Switch checked={status.active} onChange={handleToggleStatus} />
                </div>
                {status.lastUpdate && (
                    <Text
                        type="secondary"
                        style={{ fontSize: 'var(--fs-rel-lg)', display: 'block', marginTop: 8 }}
                    >
                        {t('Dernière synchronisation : {{time}}', {
                            time: status.lastUpdate.toLocaleTimeString('fr'),
                        })}
                    </Text>
                )}
            </Card>

            {/* Access warning */}
            {!status.access && (
                <Alert
                    title={t('Accès limité')}
                    description={t(
                        "Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront.",
                    )}
                    type="error"
                    showIcon
                />
            )}

            {/* Sync error */}
            {syncError && status.active && (
                <Alert
                    message={t('Erreur de synchronisation')}
                    description={syncError}
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setSyncError(null)}
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
    const { t } = useTranslation();
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
        if (type === 'start') return <Text>{t('Début de la récupération des données')}</Text>;
        if (type === 'prepare')
            return <Text>{t('Préparation de la restauration des données')}</Text>;
        if (type === 'error') {
            return (
                <Text type="danger">
                    {t(
                        "Une erreur s'est produite lors de la restauration, veuillez réessayer plus tard",
                    )}
                </Text>
            );
        }
        if (type === 'complete') {
            return (
                <Space orientation="vertical" size="small">
                    <Text type="success">{t('Vos données ont été restaurées avec succès.')}</Text>
                    <Button size="small" onClick={restartAppNow}>
                        {t("Redémarrer l'application")}
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
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <Space>
                    <Text strong>
                        {restoreProgress.type === 'sauvegarde'
                            ? t('Sauvegarde de données')
                            : t('Restauration de données')}
                    </Text>
                    {isInProgress && (
                        <Spin
                            indicator={
                                <LoadingOutlined style={{ fontSize: 'var(--fs-xl)' }} spin />
                            }
                        />
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
