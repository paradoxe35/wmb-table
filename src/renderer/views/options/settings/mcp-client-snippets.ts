import { MCP_SERVER_NAME, type McpLaunchCommand, type McpLaunchPlatform } from '@shared/mcp.types';

export type McpClientId = 'claude-code' | 'codex' | 'claude-desktop';

export interface McpClientSnippet {
    id: McpClientId;
    label: string;
    /** French i18n key: where the snippet goes. */
    hint: string;
    code: string;
}

const CLAUDE_CODE_HINT = 'Lancez cette commande dans un terminal.';
const CODEX_HINT = 'Ajoutez ces lignes au fichier ~/.codex/config.toml.';
const CLAUDE_DESKTOP_HINT =
    'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop.';
const CLAUDE_DESKTOP_REMOTE_HINT =
    'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop. Node.js doit être installé.';

const POSIX_SAFE = /^[\w@%+=:,./-]+$/;
const WINDOWS_SAFE = /^[\w@%+=:,./\\-]+$/;

/** Quotes one argument for the terminal of that system (PowerShell or cmd on Windows). */
export function quoteShellArgument(value: string, platform: McpLaunchPlatform): string {
    if (platform === 'win32') return WINDOWS_SAFE.test(value) ? value : `"${value}"`;
    return POSIX_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

/** A JSON string is also a valid TOML basic string: the same quotes and backslash escapes. */
function tomlString(value: string): string {
    return JSON.stringify(value);
}

function tomlArray(values: readonly string[]): string {
    return `[${values.map(tomlString).join(', ')}]`;
}

function claudeDesktopJson(server: Record<string, unknown>): string {
    return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: server } }, null, 2);
}

function mcpCommandArgs(launch: McpLaunchCommand, extra: readonly string[] = []): string[] {
    return [...launch.args, 'mcp', ...extra];
}

function shellWords(launch: McpLaunchCommand, extra: readonly string[] = []): string[] {
    return [launch.command, ...mcpCommandArgs(launch, extra)].map((word) =>
        quoteShellArgument(word, launch.platform),
    );
}

/** The AI app starts Wmb Table itself and talks to it over stdio. */
export function buildCommandSnippets(launch: McpLaunchCommand): McpClientSnippet[] {
    const args = mcpCommandArgs(launch);
    return [
        {
            id: 'claude-code',
            label: 'Claude Code',
            hint: CLAUDE_CODE_HINT,
            code: `claude mcp add --transport stdio --scope user ${MCP_SERVER_NAME} -- ${shellWords(launch).join(' ')}`,
        },
        {
            id: 'codex',
            label: 'Codex',
            hint: CODEX_HINT,
            code: [
                `[mcp_servers.${MCP_SERVER_NAME}]`,
                `command = ${tomlString(launch.command)}`,
                `args = ${tomlArray(args)}`,
            ].join('\n'),
        },
        {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            hint: CLAUDE_DESKTOP_HINT,
            code: claudeDesktopJson({ command: launch.command, args }),
        },
    ];
}

/** Each format follows the client's own documentation; Claude Desktop only starts stdio servers. */
export function buildHttpSnippets(url: string): McpClientSnippet[] {
    return [
        {
            id: 'claude-code',
            label: 'Claude Code',
            hint: CLAUDE_CODE_HINT,
            code: `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url}`,
        },
        {
            id: 'codex',
            label: 'Codex',
            hint: CODEX_HINT,
            code: `[mcp_servers.${MCP_SERVER_NAME}]\nurl = ${tomlString(url)}`,
        },
        {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            hint: CLAUDE_DESKTOP_REMOTE_HINT,
            code: claudeDesktopJson({ command: 'npx', args: ['-y', 'mcp-remote', url] }),
        },
    ];
}

/** Starts the HTTP server without a window, on the port the client configuration names. */
export function buildHeadlessStartCommand(launch: McpLaunchCommand, port: number): string {
    const words = shellWords(launch, ['--http', '--port', String(port)]);
    const line = words.join(' ');
    // PowerShell runs a quoted path only through its call operator.
    return launch.platform === 'win32' && words[0].startsWith('"') ? `& ${line}` : line;
}
