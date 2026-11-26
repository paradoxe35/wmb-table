import { z } from 'zod';
import * as kvRepo from '@main/database/repositories/kv-cache.repository';
import { DEFAULT_MCP_SERVER_SETTINGS, type McpServerSettings } from '@shared/mcp.types';

/** kv_cache is not a synced table: the server is set up per computer, never through Drive. */
export const MCP_SETTINGS_KEY = 'mcp-server-settings';

const storedSettingsSchema = z.object({
    enabled: z.boolean().catch(DEFAULT_MCP_SERVER_SETTINGS.enabled),
    allowWrites: z.boolean().catch(DEFAULT_MCP_SERVER_SETTINGS.allowWrites),
    port: z.number().int().min(1024).max(65_535).catch(DEFAULT_MCP_SERVER_SETTINGS.port),
});

/** Takes the decoded kv_cache value, so a process without the app database layer can use it. */
export function parseStoredMcpSettings(stored: unknown): McpServerSettings {
    const parsed = storedSettingsSchema.safeParse(stored ?? {});
    return parsed.success ? parsed.data : { ...DEFAULT_MCP_SERVER_SETTINGS };
}

export function loadMcpSettings(): McpServerSettings {
    return parseStoredMcpSettings(kvRepo.get<unknown>(MCP_SETTINGS_KEY));
}

export function saveMcpSettings(settings: McpServerSettings): void {
    kvRepo.set(MCP_SETTINGS_KEY, settings);
}
