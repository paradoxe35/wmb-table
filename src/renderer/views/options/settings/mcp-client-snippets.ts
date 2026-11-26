import { MCP_SERVER_NAME } from '@shared/mcp.types';

export type McpClientId = 'claude-code' | 'codex' | 'claude-desktop';

export interface McpClientSnippet {
    id: McpClientId;
    label: string;
    /** French i18n key: where the snippet goes. */
    hint: string;
    code: string;
}

/** Each format follows the client's own documentation; Claude Desktop only starts stdio servers. */
export function buildMcpClientSnippets(url: string): McpClientSnippet[] {
    return [
        {
            id: 'claude-code',
            label: 'Claude Code',
            hint: 'Lancez cette commande dans un terminal.',
            code: `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url}`,
        },
        {
            id: 'codex',
            label: 'Codex',
            hint: 'Ajoutez ces lignes au fichier ~/.codex/config.toml.',
            code: `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${url}"`,
        },
        {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            hint: 'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop. Node.js doit être installé.',
            code: JSON.stringify(
                {
                    mcpServers: {
                        [MCP_SERVER_NAME]: { command: 'npx', args: ['-y', 'mcp-remote', url] },
                    },
                },
                null,
                2,
            ),
        },
    ];
}
