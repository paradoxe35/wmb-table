import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMcpCommandEntry } from '@shared/mcp-command-entry';
import {
    MCP_SERVER_NAME,
    type McpClientConfigError,
    type McpClientConfigState,
    type McpClientStatus,
    type McpLaunchCommand,
} from '@shared/mcp.types';
import {
    isSameEntry,
    parseMcpServersConfig,
    readServerEntry,
    serializeMcpServersConfig,
    withServerEntry,
    type McpServersConfig,
} from './mcp-servers-json';
import { isDirectory, isPermissionError, writeConfigSafely } from './safe-config-write';

const CONFIG_FILE = 'claude_desktop_config.json';

export interface ClientEnvironment {
    platform: NodeJS.Platform;
    homeDir: string;
    env: Record<string, string | undefined>;
}

export interface ClaudeDesktopContext extends ClientEnvironment {
    launch: McpLaunchCommand;
    now?: () => Date;
}

/**
 * The folders from the MCP docs ("Connect to local MCP servers"). On Linux the app is Electron,
 * which honours XDG_CONFIG_HOME before ~/.config.
 */
export function claudeDesktopConfigDir({ platform, homeDir, env }: ClientEnvironment) {
    if (platform === 'win32') {
        return path.win32.join(
            env.APPDATA ?? path.win32.join(homeDir, 'AppData', 'Roaming'),
            'Claude',
        );
    }
    if (platform === 'darwin') {
        return path.posix.join(homeDir, 'Library', 'Application Support', 'Claude');
    }
    if (platform === 'linux') {
        return path.posix.join(
            env.XDG_CONFIG_HOME || path.posix.join(homeDir, '.config'),
            'Claude',
        );
    }
    return null;
}

function configFilePath(dir: string, platform: NodeJS.Platform): string {
    return platform === 'win32'
        ? path.win32.join(dir, CONFIG_FILE)
        : path.posix.join(dir, CONFIG_FILE);
}

type LoadedConfig = { config: McpServersConfig } | { error: McpClientConfigError };

async function loadConfig(file: string): Promise<LoadedConfig> {
    let text = '';
    try {
        text = await readFile(file, 'utf8');
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT')
            return { error: isPermissionError(error) ? 'permission-denied' : 'write-failed' };
    }
    const config = parseMcpServersConfig(text);
    return config ? { config } : { error: 'malformed' };
}

function stateOf(loaded: LoadedConfig, launch: McpLaunchCommand): McpClientConfigState {
    if ('error' in loaded) return { state: 'error', error: loaded.error };
    const existing = readServerEntry(loaded.config, MCP_SERVER_NAME);
    if (existing === undefined) return { state: 'not-configured' };
    return { state: 'configured', upToDate: isSameEntry(existing, buildMcpCommandEntry(launch)) };
}

async function locate(ctx: ClaudeDesktopContext): Promise<string | null> {
    const dir = claudeDesktopConfigDir(ctx);
    if (!dir || !(await isDirectory(dir))) return null;
    return configFilePath(dir, ctx.platform);
}

function status(configPath: string | null, state: McpClientConfigState): McpClientStatus {
    return { clientId: 'claude-desktop', configPath, ...state };
}

/** Claude Desktop counts as installed once its own folder exists; Wmb Table never creates it. */
export async function detectClaudeDesktop(ctx: ClaudeDesktopContext): Promise<McpClientStatus> {
    const file = await locate(ctx);
    if (!file) return status(null, { state: 'not-installed' });
    return status(file, stateOf(await loadConfig(file), ctx.launch));
}

export async function configureClaudeDesktop(ctx: ClaudeDesktopContext): Promise<McpClientStatus> {
    const file = await locate(ctx);
    if (!file) return status(null, { state: 'not-installed' });
    const loaded = await loadConfig(file);
    const current = stateOf(loaded, ctx.launch);
    if (!('config' in loaded) || (current.state === 'configured' && current.upToDate)) {
        return status(file, current);
    }
    const next = withServerEntry(loaded.config, MCP_SERVER_NAME, buildMcpCommandEntry(ctx.launch));
    try {
        await writeConfigSafely(
            file,
            serializeMcpServersConfig(next),
            (ctx.now ?? (() => new Date()))(),
        );
    } catch (error) {
        const code = isPermissionError(error) ? 'permission-denied' : 'write-failed';
        return status(file, { state: 'error', error: code });
    }
    return status(file, { state: 'configured', upToDate: true });
}
