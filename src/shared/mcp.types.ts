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

export interface McpServerStatus {
    settings: McpServerSettings;
    url: string | null;
    error: McpServerError | null;
}

export type McpServerSettingsPatch = Partial<Pick<McpServerSettings, 'enabled' | 'allowWrites'>>;

export function buildMcpUrl(port: number): string {
    return `http://${MCP_HOST}:${port}${MCP_PATH}`;
}
