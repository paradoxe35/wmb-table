import { Alert, Card, Checkbox, Space, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MCP_PORT, type McpServerError } from '@shared/mcp.types';
import { Hint } from './ai-shared';
import { McpConfiguration } from './mcp-configuration';
import { CopyableCode } from './mcp-copyable-code';
import { useMcpServer, type McpServerState } from './use-mcp-server';

const { Text } = Typography;

function errorMessage(error: McpServerError, t: TFunction): string {
    if (error.code === 'no-free-port') {
        return t(
            'Le serveur MCP n’a pas pu démarrer : les ports {{firstPort}} à {{lastPort}} sont déjà utilisés. Fermez l’application qui les occupe, puis réactivez le serveur.',
            { firstPort: error.firstPort, lastPort: error.lastPort },
        );
    }
    return t('Le serveur MCP n’a pas pu démarrer. Réessayez ou redémarrez Wmb Table.');
}

function ServerAddress({ url }: { url: string }) {
    const { t } = useTranslation();
    const port = Number(new URL(url).port);

    return (
        <div>
            <Text strong>{t('Adresse du serveur')}</Text>
            <CopyableCode code={url} label={t('Adresse du serveur')} />
            {port !== DEFAULT_MCP_PORT ? (
                <Hint>
                    {t(
                        'Le port habituel {{defaultPort}} était occupé : Wmb Table utilise le port {{port}}.',
                        { defaultPort: DEFAULT_MCP_PORT, port },
                    )}
                </Hint>
            ) : null}
        </div>
    );
}

/** Only the switch and its explanation show until the server is enabled. */
export function McpServerSection({ status, pending, saveFailed, update }: McpServerState) {
    const { t } = useTranslation();
    if (!status) return null;

    const { enabled, allowWrites } = status.settings;

    return (
        <Card size="small" data-testid="mcp-server-settings">
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                    <Checkbox
                        id="mcp-server-enabled"
                        checked={enabled}
                        disabled={pending}
                        onChange={(event) => update({ enabled: event.target.checked })}
                    >
                        <Text strong style={{ fontSize: 'var(--fs-rel-3xl)' }}>
                            {t('Serveur MCP')}
                        </Text>
                    </Checkbox>
                    <Hint>
                        {t(
                            'Permet à votre propre application d’IA (Claude Desktop, Claude Code, Codex…) d’utiliser votre bibliothèque Wmb Table.',
                        )}
                    </Hint>
                </div>

                {enabled ? (
                    <div>
                        <Checkbox
                            id="mcp-server-allow-writes"
                            checked={allowWrites}
                            disabled={pending}
                            onChange={(event) => update({ allowWrites: event.target.checked })}
                        >
                            {t('Autoriser les modifications (notes et sujets)')}
                        </Checkbox>
                        <Hint>
                            {allowWrites
                                ? t(
                                      'Votre application d’IA peut créer et modifier vos notes et vos sujets.',
                                  )
                                : t(
                                      'Votre application d’IA peut seulement lire votre bibliothèque.',
                                  )}
                        </Hint>
                    </div>
                ) : null}

                {enabled && saveFailed ? (
                    <Alert
                        type="error"
                        showIcon
                        title={t('Le réglage du serveur MCP n’a pas pu être enregistré.')}
                    />
                ) : null}
                {enabled && status.error ? (
                    <Alert
                        type="error"
                        showIcon
                        data-testid="mcp-server-error"
                        title={errorMessage(status.error, t)}
                    />
                ) : null}
                {enabled && status.url ? <ServerAddress url={status.url} /> : null}
                {enabled ? <McpConfiguration status={status} /> : null}
            </Space>
        </Card>
    );
}

export default function McpServerSettings() {
    return <McpServerSection {...useMcpServer()} />;
}
