import type { McpLaunchCommand, McpLaunchPlatform } from '@shared/mcp.types';

export interface LaunchEnvironment {
    platform: NodeJS.Platform;
    execPath: string;
    isPackaged: boolean;
    appPath: string;
    /** Set by the AppImage runtime to the .AppImage file itself. */
    appImage?: string;
}

function toLaunchPlatform(platform: NodeJS.Platform): McpLaunchPlatform {
    return platform === 'linux' || platform === 'darwin' || platform === 'win32'
        ? platform
        : 'other';
}

/**
 * The full path of the running copy, so users never have to find it. An AppImage runs from a
 * temporary mount that disappears when it quits, so the .AppImage file is used instead.
 */
export function detectMcpLaunchCommand(env: LaunchEnvironment): McpLaunchCommand {
    const platform = toLaunchPlatform(env.platform);
    if (!env.isPackaged) {
        return { command: env.execPath, args: [env.appPath], platform, dev: true };
    }
    const command = env.platform === 'linux' && env.appImage ? env.appImage : env.execPath;
    return { command, args: [], platform, dev: false };
}
