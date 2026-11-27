export const MCP_HOST = '127.0.0.1';
export const MCP_PATH = '/mcp';
export const DEFAULT_MCP_PORT = 23132;
export const MCP_PORT_ATTEMPTS = 10;
export const MCP_SERVER_NAME = 'wmb-table';

export interface McpServerSettings {
    enabled: boolean;
    allowWrites: boolean;
    /** The port that last worked, tried first so client configurations stay valid. */
    port: number;
}

export const DEFAULT_MCP_SERVER_SETTINGS: McpServerSettings = {
    enabled: false,
    allowWrites: false,
    port: DEFAULT_MCP_PORT,
};

export type McpServerError =
    { code: 'no-free-port'; firstPort: number; lastPort: number } | { code: 'start-failed' };

export type McpLaunchPlatform = 'linux' | 'darwin' | 'win32' | 'other';

/** How an AI app starts this installed copy of Wmb Table: `command`, `args`, then `mcp`. */
export interface McpLaunchCommand {
    command: string;
    args: string[];
    platform: McpLaunchPlatform;
    /** A development checkout, started through Electron with the app folder. */
    dev: boolean;
}

export interface McpServerStatus {
    settings: McpServerSettings;
    url: string | null;
    error: McpServerError | null;
    launch: McpLaunchCommand;
}

export type McpServerSettingsPatch = Partial<Pick<McpServerSettings, 'enabled' | 'allowWrites'>>;

export function buildMcpUrl(port: number): string {
    return `http://${MCP_HOST}:${port}${MCP_PATH}`;
}

/** The AI apps whose configuration Wmb Table can write itself. */
export type McpAutoConfigClientId = 'claude-desktop';

export type McpClientConfigError = 'malformed' | 'permission-denied' | 'write-failed';

export type McpClientConfigState =
    | { state: 'not-installed' }
    | { state: 'not-configured' }
    /** `upToDate` is false when the entry points at another copy, path or port. */
    | { state: 'configured'; upToDate: boolean }
    | { state: 'error'; error: McpClientConfigError };

export type McpClientStatus = McpClientConfigState & {
    clientId: McpAutoConfigClientId;
    /** The file Wmb Table reads and writes; null when the app is not installed. */
    configPath: string | null;
};

export interface McpConfigureClientRequest {
    clientId: McpAutoConfigClientId;
}
