import type { McpLaunchCommand, McpLaunchPlatform } from './mcp.types';

/** The `mcpServers` entry of an AI app that starts Wmb Table itself (stdio). */
export interface McpCommandEntry {
    command: string;
    args: string[];
}

/**
 * On Linux, Chromium starts its sandbox before Wmb Table's own code runs, and that fails as
 * root, in containers and where user namespaces are restricted. This mode never loads a web
 * page, so the switch costs nothing and lets the command start everywhere.
 */
function sandboxSwitches(platform: McpLaunchPlatform): string[] {
    return platform === 'linux' ? ['--no-sandbox'] : [];
}

export function buildMcpCommandArgs(
    launch: McpLaunchCommand,
    extra: readonly string[] = [],
): string[] {
    return [...launch.args, ...sandboxSwitches(launch.platform), 'mcp', ...extra];
}

export function buildMcpCommandEntry(launch: McpLaunchCommand): McpCommandEntry {
    return { command: launch.command, args: buildMcpCommandArgs(launch) };
}
