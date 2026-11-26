import { Tabs, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { buildMcpUrl, type McpServerStatus } from '@shared/mcp.types';
import { Hint } from './ai-shared';
import {
    buildCommandSnippets,
    buildHeadlessStartCommand,
    buildHttpSnippets,
    type McpClientSnippet,
} from './mcp-client-snippets';
import { CopyableCode } from './mcp-copyable-code';

const { Text } = Typography;

type ConnectionMode = 'command' | 'http' | 'headless';

function ClientSnippets({
    mode,
    snippets,
}: {
    mode: ConnectionMode;
    snippets: McpClientSnippet[];
}) {
    const { t } = useTranslation();
    return (
        <Tabs
            size="small"
            items={snippets.map((snippet) => ({
                key: snippet.id,
                label: snippet.label,
                children: (
                    <div data-testid={`mcp-snippet-${mode}-${snippet.id}`}>
                        <Hint>{t(snippet.hint)}</Hint>
                        <CopyableCode code={snippet.code} label={snippet.label} />
                    </div>
                ),
            }))}
        />
    );
}

function CommandMode({ status }: { status: McpServerStatus }) {
    const { t } = useTranslation();
    return (
        <div data-testid="mcp-mode-command">
            <Hint>
                {t(
                    'Votre application d’IA lance Wmb Table elle-même, sans fenêtre : Wmb Table n’a pas besoin d’être ouvert.',
                )}
            </Hint>
            {status.launch.dev ? (
                <Hint>
                    {t('Commande de développement : cette copie de Wmb Table n’est pas installée.')}
                </Hint>
            ) : null}
            <ClientSnippets mode="command" snippets={buildCommandSnippets(status.launch)} />
        </div>
    );
}

function HttpMode({ url }: { url: string }) {
    const { t } = useTranslation();
    return (
        <div data-testid="mcp-mode-http">
            <Hint>
                {t('Wmb Table doit rester ouvert pendant que votre application d’IA l’utilise.')}
            </Hint>
            <ClientSnippets mode="http" snippets={buildHttpSnippets(url)} />
            <Hint>
                {t(
                    'Dans une autre application, ajoutez un serveur MCP « Streamable HTTP » avec cette adresse.',
                )}
            </Hint>
        </div>
    );
}

function HeadlessMode({ status }: { status: McpServerStatus }) {
    const { t } = useTranslation();
    const port = status.settings.port;
    const startLabel = t('Démarrer le serveur');
    return (
        <div data-testid="mcp-mode-headless">
            <Text strong>{startLabel}</Text>
            <Hint>
                {t(
                    'Lancez cette commande dans un terminal et laissez-le ouvert ; Ctrl+C arrête le serveur. Fermez d’abord Wmb Table s’il est ouvert : il utilise déjà ce port.',
                )}
            </Hint>
            <CopyableCode
                code={buildHeadlessStartCommand(status.launch, port)}
                label={startLabel}
            />
            <ClientSnippets mode="headless" snippets={buildHttpSnippets(buildMcpUrl(port))} />
        </div>
    );
}

/** The three ways to connect an AI app, each with ready-to-copy client settings. */
export function McpConfiguration({ status }: { status: McpServerStatus }) {
    const { t } = useTranslation();
    const items = [
        {
            key: 'command',
            label: t('Commande (recommandé)'),
            children: <CommandMode status={status} />,
        },
        ...(status.url
            ? [{ key: 'http', label: 'HTTP', children: <HttpMode url={status.url} /> }]
            : []),
        {
            key: 'headless',
            label: t('HTTP sans interface'),
            children: <HeadlessMode status={status} />,
        },
    ];

    return (
        <div data-testid="mcp-configuration">
            <Text strong>{t('Configuration')}</Text>
            <Tabs className="mcp-configuration__modes" items={items} />
        </div>
    );
}
