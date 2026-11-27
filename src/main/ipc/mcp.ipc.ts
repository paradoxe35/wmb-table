import { homedir } from 'node:os';
import { McpChannels } from '@shared/ipc.types';
import { registerHandler } from './ipc-bridge';
import { parseAiInput } from './ai.schemas';
import { mcpConfigureClientSchema, mcpSettingsPatchSchema } from './mcp.schemas';
import {
    currentLaunchCommand,
    getMcpServerStatus,
    updateMcpServerSettings,
} from '@main/services/mcp/mcp-server.service';
import {
    configureClaudeDesktop,
    detectClaudeDesktop,
    type ClaudeDesktopContext,
} from '@main/services/mcp/clients/claude-desktop-client';

/** Paths come from this machine only; the renderer just names the app. */
function claudeDesktopContext(): ClaudeDesktopContext {
    return {
        platform: process.platform,
        homeDir: homedir(),
        env: process.env,
        launch: currentLaunchCommand(),
    };
}

export function registerMcpHandlers(): void {
    registerHandler(McpChannels.getStatus, async () => getMcpServerStatus());

    registerHandler(McpChannels.updateSettings, async (_event, patch) =>
        updateMcpServerSettings(parseAiInput(mcpSettingsPatchSchema, patch, 'MCP server settings')),
    );

    registerHandler(McpChannels.detectClients, async () => [
        await detectClaudeDesktop(claudeDesktopContext()),
    ]);

    registerHandler(McpChannels.configureClient, async (_event, request) => {
        parseAiInput(mcpConfigureClientSchema, request, 'MCP client');
        return configureClaudeDesktop(claudeDesktopContext());
    });
}
