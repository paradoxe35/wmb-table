import { McpChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import { parseAiInput } from './ai.schemas';
import { mcpSettingsPatchSchema } from './mcp.schemas';
import { getMcpServerStatus, updateMcpServerSettings } from '@main/services/mcp/mcp-server.service';

export function registerMcpHandlers(): void {
    registerHandler(McpChannels.getStatus, async () => getMcpServerStatus());

    registerHandler(McpChannels.updateSettings, async (_event, patch) =>
        updateMcpServerSettings(parseAiInput(mcpSettingsPatchSchema, patch, 'MCP server settings')),
    );
}
