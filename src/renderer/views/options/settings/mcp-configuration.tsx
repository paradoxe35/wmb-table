import type { ReactNode } from 'react';
import { Collapse, Tabs, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { buildMcpUrl, type McpServerStatus } from '@shared/mcp.types';
import { Hint } from './ai-shared';
import {
    buildHeadlessStartCommand,
    buildMcpClientSetups,
    type McpClientId,
    type McpClientSetup,
    type McpConnectionMethod,
    type McpSnippet,
} from './mcp-client-snippets';
import { CopyableCode } from './mcp-copyable-code';

const { Text } = Typography;

export interface McpConfigurationProps {
    status: McpServerStatus;
    /** Room for a per-client action such as writing the client's config file itself. */
    renderClientAction?: (clientId: McpClientId) => ReactNode;
}

function useMethodText() {
    const { t } = useTranslation();
    return {
        name: (method: McpConnectionMethod) => (method === 'http' ? 'HTTP' : t('Commande')),
        note: (method: McpConnectionMethod) =>
            method === 'http'
                ? t('Wmb Table doit être ouvert.')
                : t('Fonctionne même quand Wmb Table est fermé.'),
    };
}

function SnippetBlock({
    snippet,
    title,
    copyLabel,
    testId,
    secondary = false,
}: {
    snippet: McpSnippet;
    title: string;
    copyLabel: string;
    testId: string;
    secondary?: boolean;
}) {
    const { t } = useTranslation();
    const method = useMethodText();
    return (
        <div data-testid={testId} style={{ marginTop: secondary ? 16 : 8 }}>
            {secondary ? <Text type="secondary">{title}</Text> : <Text strong>{title}</Text>}
            <Hint>{`${t(snippet.hint)} ${method.note(snippet.method)}`}</Hint>
            <CopyableCode code={snippet.code} label={copyLabel} />
        </div>
    );
}

function ClientTab({ setup, action }: { setup: McpClientSetup; action: ReactNode }) {
    const { t } = useTranslation();
    const method = useMethodText();
    const label = t(setup.label);
    return (
        <div data-testid={`mcp-client-${setup.id}`}>
            {action}
            <SnippetBlock
                snippet={setup.recommended}
                title={t('{{method}} (recommandé)', {
                    method: method.name(setup.recommended.method),
                })}
                copyLabel={label}
                testId={`mcp-snippet-${setup.id}-recommended`}
            />
            <SnippetBlock
                snippet={setup.alternative}
                title={t('Autre méthode : {{method}}', {
                    method: method.name(setup.alternative.method),
                })}
                copyLabel={`${label} (${method.name(setup.alternative.method)})`}
                testId={`mcp-snippet-${setup.id}-alternative`}
                secondary
            />
        </div>
    );
}

function HeadlessServer({ status }: { status: McpServerStatus }) {
    const { t } = useTranslation();
    const title = t('Serveur HTTP sans fenêtre');
    return (
        <div data-testid="mcp-headless">
            <Text strong>{title}</Text>
            <Hint>
                {t(
                    'Lancez cette commande dans un terminal et laissez-le ouvert ; Ctrl+C arrête le serveur. Fermez d’abord Wmb Table s’il est ouvert : il utilise déjà ce port.',
                )}
            </Hint>
            <CopyableCode
                code={buildHeadlessStartCommand(status.launch, status.settings.port)}
                label={title}
            />
        </div>
    );
}

/** One tab per AI app, each with its recommended setup first and the other way below. */
export function McpConfiguration({ status, renderClientAction }: McpConfigurationProps) {
    const { t } = useTranslation();
    const url = status.url ?? buildMcpUrl(status.settings.port);
    const setups = buildMcpClientSetups(status.launch, url);

    return (
        <div data-testid="mcp-configuration">
            <Text strong>{t('Configuration')}</Text>
            {status.launch.dev ? (
                <Hint>
                    {t('Commande de développement : cette copie de Wmb Table n’est pas installée.')}
                </Hint>
            ) : null}
            <Tabs
                className="mcp-configuration__clients"
                items={setups.map((setup) => ({
                    key: setup.id,
                    label: t(setup.label),
                    children: <ClientTab setup={setup} action={renderClientAction?.(setup.id)} />,
                }))}
            />
            <Collapse
                size="small"
                ghost
                items={[
                    {
                        key: 'advanced',
                        label: t('Avancé'),
                        children: <HeadlessServer status={status} />,
                    },
                ]}
            />
        </div>
    );
}
