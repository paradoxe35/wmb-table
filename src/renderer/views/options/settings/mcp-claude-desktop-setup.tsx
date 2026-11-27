import { CheckCircleFilled } from '@ant-design/icons';
import { Alert, Button, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { McpClientConfigError } from '@shared/mcp.types';
import { Hint } from './ai-shared';
import { useClaudeDesktopSetup, type ClaudeDesktopSetupState } from './use-claude-desktop-setup';

const { Link, Text } = Typography;

export const CLAUDE_DESKTOP_DOWNLOAD_URL = 'https://claude.ai/download';

function errorMessage(error: McpClientConfigError, t: TFunction): string {
    if (error === 'malformed') {
        return t(
            'Le fichier de configuration de Claude Desktop n’est pas un JSON valide : Wmb Table ne l’a pas modifié. Corrigez-le, ou ajoutez la configuration ci-dessous à la main.',
        );
    }
    if (error === 'permission-denied') {
        return t(
            'Wmb Table n’a pas le droit de modifier le fichier de configuration de Claude Desktop. Ajoutez la configuration ci-dessous à la main.',
        );
    }
    return t(
        'Le fichier de configuration de Claude Desktop n’a pas pu être lu ou enregistré. Ajoutez la configuration ci-dessous à la main.',
    );
}

function NotInstalled() {
    const { t } = useTranslation();
    return (
        <div>
            <Text>{t('Claude Desktop n’est pas installé sur cet ordinateur.')}</Text>{' '}
            <Link
                href={CLAUDE_DESKTOP_DOWNLOAD_URL}
                onClick={(event) => {
                    event.preventDefault();
                    void window.api.app.openExternal(CLAUDE_DESKTOP_DOWNLOAD_URL);
                }}
            >
                {t('Télécharger Claude Desktop')}
            </Link>
            <Hint>
                {t(
                    'Après l’installation, revenez ici pour le configurer automatiquement, ou copiez la configuration ci-dessous.',
                )}
            </Hint>
        </div>
    );
}

function AlreadyConfigured() {
    const { t } = useTranslation();
    return (
        <Text type="success" data-testid="mcp-claude-desktop-configured">
            <CheckCircleFilled /> {t('Déjà configuré')}
        </Text>
    );
}

/** The state of Claude Desktop's own file, and the button that writes our entry into it. */
export function ClaudeDesktopSetupView({
    status,
    pending,
    justConfigured,
    configure,
}: ClaudeDesktopSetupState) {
    const { t } = useTranslation();
    if (!status) return null;

    let content;
    if (status.state === 'not-installed') {
        content = <NotInstalled />;
    } else if (status.state === 'error') {
        content = <Alert type="error" showIcon title={errorMessage(status.error, t)} />;
    } else if (status.state === 'configured' && status.upToDate) {
        content = justConfigured ? (
            <Alert
                type="success"
                showIcon
                title={t(
                    'Wmb Table a été ajouté à Claude Desktop. Redémarrez Claude Desktop pour l’utiliser.',
                )}
            />
        ) : (
            <AlreadyConfigured />
        );
    } else {
        const outdated = status.state === 'configured';
        content = (
            <div>
                {outdated ? <AlreadyConfigured /> : null}
                <div>
                    <Button
                        type={outdated ? 'default' : 'primary'}
                        loading={pending}
                        onClick={configure}
                        data-testid="mcp-claude-desktop-configure"
                    >
                        {outdated ? t('Mettre à jour') : t('Configurer automatiquement')}
                    </Button>
                </div>
                <Hint>
                    {outdated
                        ? t(
                              'La configuration enregistrée dans Claude Desktop ne correspond plus à cette copie de Wmb Table.',
                          )
                        : t(
                              'Ajoute Wmb Table au fichier de configuration de Claude Desktop, après en avoir fait une copie de sauvegarde. Les autres serveurs restent inchangés.',
                          )}
                </Hint>
            </div>
        );
    }

    return (
        <div data-testid="mcp-claude-desktop-setup" data-state={status.state}>
            {content}
            {status.configPath ? <Hint>{status.configPath}</Hint> : null}
        </div>
    );
}

export function ClaudeDesktopSetup() {
    return <ClaudeDesktopSetupView {...useClaudeDesktopSetup()} />;
}
