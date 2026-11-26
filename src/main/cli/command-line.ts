export type McpTransportKind = 'stdio' | 'http';

export interface McpCliCommand {
    kind: 'mcp';
    transport: McpTransportKind;
    /** Set only when the user asked for an exact port. */
    port?: number;
    language?: string;
}

export type CliCommand =
    { kind: 'gui' } | { kind: 'help' } | { kind: 'invalid'; message: string } | McpCliCommand;

/**
 * Electron needs a display unless these switches are on the real command line; the main
 * script runs too late to add them itself. No web page is ever loaded in this mode, so the
 * renderer sandbox has nothing to protect and is turned off (it also refuses to start as root).
 */
export const HEADLESS_SWITCHES = ['--ozone-platform=headless', '--disable-gpu', '--no-sandbox'];

/** Set by the relaunching parent, so the child stops if that parent is killed. */
export const RELAUNCHED_ENV = 'WMB_TABLE_MCP_RELAUNCHED';

export const MCP_USAGE = `Usage:
  wmb-table mcp                     Serve the library to an AI app over stdio (no window).
  wmb-table mcp --http [--port N]   Serve it over HTTP on 127.0.0.1 until stopped (no window).

Options:
  --language <code>   Content language the tools use (default: the app setting).
  --port <N>          Exact port for --http (default: the port set in the app, or the next free one).
  -h, --help          Show this help.
`;

const LANGUAGE_CODE = /^[A-Za-z]{2,8}([-_][A-Za-z0-9]{1,8})*$/;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

/**
 * Drops the executable, and the app folder when Electron runs an unpackaged app
 * (`electron . mcp`), so packaged and development launches look the same.
 */
export function userArguments(argv: readonly string[], defaultApp: boolean): string[] {
    const args = argv.slice(1);
    if (!defaultApp) return args;
    const appPathIndex = args.findIndex((arg) => !arg.startsWith('-'));
    return appPathIndex === -1 ? args : args.filter((_, index) => index !== appPathIndex);
}

function invalid(message: string): CliCommand {
    return { kind: 'invalid', message };
}

function splitOption(arg: string): [string, string | undefined] {
    const equals = arg.indexOf('=');
    return equals === -1 ? [arg, undefined] : [arg.slice(0, equals), arg.slice(equals + 1)];
}

function parsePort(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const port = Number(value);
    return port >= MIN_PORT && port <= MAX_PORT ? port : null;
}

function parseMcpOptions(options: readonly string[]): CliCommand {
    let transport: McpTransportKind = 'stdio';
    let port: number | undefined;
    let language: string | undefined;

    for (let index = 0; index < options.length; index++) {
        const arg = options[index];
        if (HEADLESS_SWITCHES.includes(arg)) continue;
        if (arg === '-h' || arg === '--help') return { kind: 'help' };

        const [name, inlineValue] = splitOption(arg);
        if (name === '--http' && inlineValue === undefined) {
            transport = 'http';
            continue;
        }
        if (name !== '--port' && name !== '--language') {
            return invalid(`Unknown option "${arg}".`);
        }

        const value = inlineValue ?? options[++index];
        if (value === undefined || value === '' || value.startsWith('--')) {
            return invalid(`${name} needs a value.`);
        }
        if (name === '--language') {
            if (!LANGUAGE_CODE.test(value)) return invalid(`"${value}" is not a language code.`);
            language = value;
            continue;
        }
        const parsedPort = parsePort(value);
        if (parsedPort === null) {
            return invalid(`--port must be a number from ${MIN_PORT} to ${MAX_PORT}.`);
        }
        port = parsedPort;
    }

    if (port !== undefined && transport !== 'http')
        return invalid('--port only works with --http.');
    return { kind: 'mcp', transport, port, language };
}

/** Anything before the command word belongs to Electron or Chromium and is left alone. */
export function parseCliCommand(args: readonly string[]): CliCommand {
    const commandIndex = args.findIndex((arg) => !arg.startsWith('-'));
    if (commandIndex === -1 || args[commandIndex] !== 'mcp') return { kind: 'gui' };
    return parseMcpOptions(args.slice(commandIndex + 1));
}

export interface RelaunchEnvironment {
    argv: readonly string[];
    platform: NodeJS.Platform;
    defaultApp: boolean;
}

/** The arguments to start the headless child with, or null when this process can serve itself. */
export function planHeadlessRelaunch(env: RelaunchEnvironment): string[] | null {
    if (env.platform !== 'linux') return null;
    if (env.argv.includes(HEADLESS_SWITCHES[0])) return null;
    const command = parseCliCommand(userArguments(env.argv, env.defaultApp));
    if (command.kind !== 'mcp') return null;
    return [...env.argv.slice(1), ...HEADLESS_SWITCHES];
}
