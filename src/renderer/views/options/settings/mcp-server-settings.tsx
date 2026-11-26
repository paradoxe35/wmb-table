import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Space, Tabs, Tooltip, Typography } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MCP_PORT, type McpServerError } from '@shared/mcp.types';
import { Hint } from './ai-shared';
import { buildMcpClientSnippets } from './mcp-client-snippets';
import { useMcpServer, type McpServerState } from './use-mcp-server';

const { Text } = Typography;

const COPIED_FEEDBACK_MS = 1500;

const CODE_BLOCK_STYLE = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    padding: '6px 8px',
    borderRadius: 6,
    background: 'var(--ant-color-fill-tertiary)',
} as const;

const CODE_STYLE = {
    flex: 1,
    minWidth: 0,
    margin: 0,
    fontFamily: 'var(--ant-font-family-code, monospace)',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 'var(--fs-rel-lg)',
} as const;

function errorMessage(error: McpServerError, t: TFunction): string {
    if (error.code === 'no-free-port') {
        return t(
            'Le serveur MCP n’a pas pu démarrer : les ports {{firstPort}} à {{lastPort}} sont déjà utilisés. Fermez l’application qui les occupe, puis réactivez le serveur.',
            { firstPort: error.firstPort, lastPort: error.lastPort },
        );
    }
    return t('Le serveur MCP n’a pas pu démarrer. Réessayez ou redémarrez Wmb Table.');
}

function CopyableCode({ code, label }: { code: string; label: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    async function copy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
    }

    return (
        <div className="mcp-server__code" style={CODE_BLOCK_STYLE}>
            <pre style={CODE_STYLE}>{code}</pre>
            <Tooltip title={copied ? t('Copié') : t('Copier')}>
                <Button
                    type="text"
                    size="small"
                    aria-label={t('Copier {{label}}', { label })}
                    icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={() => void copy()}
                />
            </Tooltip>
        </div>
    );
}

function ConnectionDetails({ url }: { url: string }) {
    const { t } = useTranslation();
    const port = Number(new URL(url).port);
    const snippets = buildMcpClientSnippets(url);

    return (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
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
            <div>
                <Text strong>{t('Connecter votre application')}</Text>
                <Tabs
                    size="small"
                    items={snippets.map((snippet) => ({
                        key: snippet.id,
                        label: snippet.label,
                        children: (
                            <div data-testid={`mcp-snippet-${snippet.id}`}>
                                <Hint>{t(snippet.hint)}</Hint>
                                <CopyableCode code={snippet.code} label={snippet.label} />
                            </div>
                        ),
                    }))}
                />
                <Hint>
                    {t(
                        'Dans une autre application, ajoutez un serveur MCP « Streamable HTTP » avec cette adresse.',
                    )}
                </Hint>
            </div>
        </Space>
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
                {enabled && status.url ? <ConnectionDetails url={status.url} /> : null}
            </Space>
        </Card>
    );
}

export default function McpServerSettings() {
    return <McpServerSection {...useMcpServer()} />;
}
