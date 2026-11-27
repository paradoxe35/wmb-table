import {
    buildMcpCommandArgs,
    buildMcpCommandEntry,
    type McpCommandEntry,
} from '@shared/mcp-command-entry';
import { MCP_SERVER_NAME, type McpLaunchCommand, type McpLaunchPlatform } from '@shared/mcp.types';

export type McpClientId = 'claude-desktop' | 'codex' | 'other';

/** `http` needs Wmb Table open; with `command` the AI app starts Wmb Table itself (stdio). */
export type McpConnectionMethod = 'http' | 'command';

export interface McpSnippet {
    method: McpConnectionMethod;
    /** French i18n key: where the snippet goes. */
    hint: string;
    code: string;
}

export interface McpClientSetup {
    id: McpClientId;
    /** A product name, or a French i18n key for the last tab. */
    label: string;
    recommended: McpSnippet;
    alternative: McpSnippet;
}

const CODEX_HINT = 'Ajoutez ces lignes au fichier ~/.codex/config.toml.';
const CLAUDE_DESKTOP_HINT =
    'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop.';
const CLAUDE_DESKTOP_REMOTE_HINT =
    'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop. Node.js doit être installé.';
const OTHER_HTTP_HINT = 'Ajoutez un serveur MCP « Streamable HTTP » avec cette adresse.';
const OTHER_COMMAND_HINT =
    'Ou laissez votre application lancer Wmb Table avec cette commande (stdio).';

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

function claudeDesktopJson(server: McpCommandEntry): string {
    return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: server } }, null, 2);
}

function shellWords(launch: McpLaunchCommand, extra: readonly string[] = []): string[] {
    return [launch.command, ...buildMcpCommandArgs(launch, extra)].map((word) =>
        quoteShellArgument(word, launch.platform),
    );
}

/**
 * Each client's recommended way first, following its own documentation. Claude Desktop only
 * starts local servers itself, so the command is best there; reaching a URL needs mcp-remote.
 */
export function buildMcpClientSetups(launch: McpLaunchCommand, url: string): McpClientSetup[] {
    const args = buildMcpCommandArgs(launch);
    const commandLine = shellWords(launch).join(' ');
    return [
        {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            recommended: {
                method: 'command',
                hint: CLAUDE_DESKTOP_HINT,
                code: claudeDesktopJson(buildMcpCommandEntry(launch)),
            },
            alternative: {
                method: 'http',
                hint: CLAUDE_DESKTOP_REMOTE_HINT,
                code: claudeDesktopJson({ command: 'npx', args: ['-y', 'mcp-remote', url] }),
            },
        },
        {
            id: 'codex',
            label: 'Codex',
            recommended: {
                method: 'http',
                hint: CODEX_HINT,
                code: `[mcp_servers.${MCP_SERVER_NAME}]\nurl = ${tomlString(url)}`,
            },
            alternative: {
                method: 'command',
                hint: CODEX_HINT,
                code: [
                    `[mcp_servers.${MCP_SERVER_NAME}]`,
                    `command = ${tomlString(launch.command)}`,
                    `args = ${tomlArray(args)}`,
                ].join('\n'),
            },
        },
        {
            id: 'other',
            label: 'Autre application',
            recommended: { method: 'http', hint: OTHER_HTTP_HINT, code: url },
            alternative: { method: 'command', hint: OTHER_COMMAND_HINT, code: commandLine },
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
