import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Alert, Button, Card, Progress, Space, Spin, Typography } from 'antd';
import {
    CloudDownloadOutlined,
    DownloadOutlined,
    LoadingOutlined,
    ReloadOutlined,
    StopOutlined,
} from '@ant-design/icons';
import type { TFunction } from 'i18next';
import type { UpdaterDownloadProgress, UpdaterNotification } from '@shared/types';
import { formatBytes } from './tts-shared';
import { useUpdateStatus, type UpdateStatus } from './use-update-status';

const { Text } = Typography;

const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between' };
const PROGRESS_BAR: React.CSSProperties = { width: '100%', maxWidth: 320 };

interface ActionSpec {
    label: string;
    icon: ReactNode;
    onClick: () => void;
}

/** One alert, described as data, instead of a copy per state */
interface StateView {
    title: string;
    description: ReactNode;
    tone: 'info' | 'success' | 'warning' | 'error';
    action?: ActionSpec;
    /** Secondary control rendered inside the alert */
    inlineAction?: ActionSpec;
}

const Spinner = () => (
    <Spin indicator={<LoadingOutlined style={{ fontSize: 'var(--fs-3xl)' }} spin />} />
);

function describeState(status: UpdateStatus, t: TFunction): StateView {
    const { info } = status;

    if (info?.updaterEnabled === false) {
        return {
            tone: 'info',
            title: t('Mise à jour automatique indisponible'),
            description: t(
                "Les mises à jour automatiques sont disponibles uniquement dans l'application installée.",
            ),
        };
    }

    // electron-updater declines to check here, so no update state ever arrives
    if (info?.canAutoUpdate === false) {
        return {
            tone: 'info',
            title: t('Mise à jour automatique indisponible'),
            description: t(
                "La mise à jour automatique n'est pas prise en charge pour votre type d'installation. Veuillez télécharger la dernière version depuis le site.",
            ),
            action: siteAction(status, t),
        };
    }

    switch (info?.type) {
        case 'hasUpdate':
            return {
                tone: 'info',
                title: t("Mise à jour de l'application"),
                description: t(
                    'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.',
                ),
                action: {
                    label: t('Mettre à jour'),
                    icon: <CloudDownloadOutlined />,
                    onClick: status.download,
                },
            };

        case 'downloaded':
            return {
                tone: 'success',
                title: t('Téléchargement terminé'),
                description: (
                    <>
                        {t(
                            "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.",
                        )}
                        {info.requiresElevatedInstall && (
                            <Hint>
                                {t(
                                    "Votre mot de passe administrateur sera demandé pour terminer l'installation.",
                                )}
                            </Hint>
                        )}
                    </>
                ),
                action: {
                    label: t('Installer la mise à jour'),
                    icon: <ReloadOutlined />,
                    onClick: status.install,
                },
            };

        case 'error': {
            const offline = info.errorKind === 'network';
            const retryAction: ActionSpec = {
                label: t('Réessayer'),
                icon: <ReloadOutlined />,
                onClick: status.retry,
            };
            // A failed download must not be a dead end, so the site leads and retry follows
            const downloadFailed = status.lastAction === 'download';

            return {
                tone: offline ? 'warning' : 'error',
                title: offline ? t('Connexion indisponible') : t('Erreur !'),
                description: offline
                    ? t(
                          'Impossible de contacter le serveur de mise à jour. Vérifiez votre connexion, puis réessayez.',
                      )
                    : t(
                          "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.",
                      ),
                action: downloadFailed ? siteAction(status, t) : retryAction,
                inlineAction: downloadFailed ? retryAction : undefined,
            };
        }

        case 'noUpdate':
            return {
                tone: 'info',
                title: t('Aucune mise à jour disponible'),
                description: t("Vous utilisez déjà la dernière version de l'application."),
            };

        default:
            return {
                tone: 'info',
                title: t('Aucune vérification effectuée'),
                description: t('Vérifiez si une nouvelle version est disponible.'),
            };
    }
}

function siteAction(status: UpdateStatus, t: TFunction): ActionSpec {
    return {
        label: t('Télécharger depuis le site'),
        icon: <DownloadOutlined />,
        onClick: status.openDownloadPage,
    };
}

const Hint = ({ children }: { children: ReactNode }) => (
    <div>
        <Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
            {children}
        </Text>
    </div>
);

function DownloadProgress({
    progress,
    onCancel,
}: {
    progress: UpdaterDownloadProgress | undefined;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    // Until the first byte lands there is no total, so percent would be meaningless
    const started = !!progress?.total;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
            <Space>
                <Text strong>
                    {started
                        ? t('Téléchargement de la mise à jour')
                        : t('Préparation du téléchargement...')}
                </Text>
                <Spinner />
            </Space>
            <div style={PROGRESS_BAR}>
                <Progress
                    percent={started ? Math.min(100, Math.round(progress.percent)) : 0}
                    size="small"
                    status="active"
                    showInfo={started}
                />
            </div>
            {started && (
                <Text type="secondary">
                    {formatBytes(progress.transferred, t)} / {formatBytes(progress.total, t)}
                    {progress.bytesPerSecond > 0 &&
                        ` · ${formatBytes(progress.bytesPerSecond, t)}/s`}
                </Text>
            )}
            <Button
                size="small"
                icon={<StopOutlined />}
                onClick={onCancel}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
                {t('Annuler')}
            </Button>
        </Space>
    );
}

function Versions({ info }: { info: UpdaterNotification | undefined }) {
    const { t } = useTranslation();
    const next = info?.updateInfo?.version;

    return (
        <Space orientation="vertical" size="small">
            {info?.currentVersion && (
                <Text type="secondary">
                    {t('Version actuelle')}: {info.currentVersion}
                </Text>
            )}
            {next && next !== info?.currentVersion && (
                <Text type="secondary">
                    {t('Nouvelle version')}: {next}
                </Text>
            )}
        </Space>
    );
}

export default function UpdateTab() {
    const { t } = useTranslation();
    const status = useUpdateStatus();
    const { info, checking, isDownloading } = status;
    const view = describeState(status, t);

    return (
        <Card size="small" variant="borderless">
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <div style={ROW}>
                    <Text strong>
                        <ReloadOutlined /> {t('Mise à jour')}
                    </Text>
                    <Button
                        size="small"
                        loading={checking}
                        disabled={
                            info?.updaterEnabled === false ||
                            info?.canAutoUpdate === false ||
                            isDownloading
                        }
                        onClick={status.check}
                    >
                        {t('Vérifier')}
                    </Button>
                </div>

                <Versions info={info} />

                {checking ? (
                    <Space>
                        <Text>{t('Vérification des mises à jour...')}</Text>
                        <Spinner />
                    </Space>
                ) : isDownloading ? (
                    <DownloadProgress
                        progress={info?.progress?.downloadProgress}
                        onCancel={status.cancel}
                    />
                ) : (
                    <>
                        <Alert
                            type={view.tone}
                            showIcon
                            title={view.title}
                            description={view.description}
                            action={
                                view.inlineAction && (
                                    <Button
                                        size="small"
                                        icon={view.inlineAction.icon}
                                        onClick={view.inlineAction.onClick}
                                    >
                                        {view.inlineAction.label}
                                    </Button>
                                )
                            }
                        />
                        {view.action && (
                            <Button
                                type="primary"
                                size="small"
                                icon={view.action.icon}
                                loading={status.busy}
                                onClick={view.action.onClick}
                            >
                                {view.action.label}
                            </Button>
                        )}
                    </>
                )}
            </Space>
        </Card>
    );
}
