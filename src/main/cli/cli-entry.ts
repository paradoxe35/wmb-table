import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { app } from 'electron';
import { keepStdoutForMcp } from '@main/lib/logger';
import {
    MCP_USAGE,
    RELAUNCHED_ENV,
    parseCliCommand,
    planHeadlessRelaunch,
    userArguments,
} from './command-line';

const defaultApp = Boolean(process.defaultApp);

export const cliCommand = parseCliCommand(userArguments(process.argv, defaultApp));

/**
 * Replacing this process keeps its PID, so the AI app's signals and pipes reach the server
 * itself. `execve` is still experimental in Node, so a waiting child is the fallback.
 */
function relaunchHeadless(args: string[]): never {
    try {
        process.execve?.(process.execPath, [process.execPath, ...args], process.env);
    } catch (error) {
        process.stderr.write(`Relaunching in place failed, starting a child: ${String(error)}\n`);
    }
    const child = spawnSync(process.execPath, args, {
        stdio: 'inherit',
        env: { ...process.env, [RELAUNCHED_ENV]: '1' },
    });
    if (child.error) process.stderr.write(`Wmb Table could not start: ${child.error.message}\n`);
    process.exit(child.status ?? 1);
}

/** Chromium keeps its own state in userData; a separate folder keeps it apart from the open app. */
function isolateChromiumState(): void {
    app.setPath('userData', resolve(app.getPath('userData'), 'mcp-cli'));
}

if (cliCommand.kind === 'invalid') {
    process.stderr.write(`${cliCommand.message}\n\n${MCP_USAGE}`);
    process.exit(2);
}

if (cliCommand.kind === 'help') {
    process.stdout.write(MCP_USAGE);
    process.exit(0);
}

if (cliCommand.kind === 'mcp') {
    const relaunchArgs = planHeadlessRelaunch({
        argv: process.argv,
        platform: process.platform,
        defaultApp,
    });
    if (relaunchArgs) relaunchHeadless(relaunchArgs);
    if (cliCommand.transport === 'stdio') keepStdoutForMcp();
    isolateChromiumState();
}
