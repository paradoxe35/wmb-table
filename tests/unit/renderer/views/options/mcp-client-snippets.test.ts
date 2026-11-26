import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import type { McpLaunchCommand } from '@shared/mcp.types';
import {
    buildHeadlessStartCommand,
    buildMcpClientSetups,
    quoteShellArgument,
    type McpClientId,
    type McpClientSetup,
} from '@renderer/views/options/settings/mcp-client-snippets';

const URL = 'http://127.0.0.1:23133/mcp';

const DEB: McpLaunchCommand = {
    command: '/opt/Wmb Table/wmb-table',
    args: [],
    platform: 'linux',
    dev: false,
};
const APPIMAGE: McpLaunchCommand = {
    command: '/home/marie/Applications/Wmb-Table-2.0.0.AppImage',
    args: [],
    platform: 'linux',
    dev: false,
};
const WINDOWS: McpLaunchCommand = {
    command: 'C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\Wmb Table.exe',
    args: [],
    platform: 'win32',
    dev: false,
};
const MAC: McpLaunchCommand = {
    command: '/Applications/Wmb Table.app/Contents/MacOS/Wmb Table',
    args: [],
    platform: 'darwin',
    dev: false,
};
const DEV: McpLaunchCommand = {
    command: '/home/dev/wmb-table/node_modules/electron/dist/electron',
    args: ['/home/dev/wmb-table'],
    platform: 'linux',
    dev: true,
};

/** Parses the two-line TOML the Codex snippet writes, with JSON rules for its strings. */
function parseCodexTable(toml: string): { table: string; values: Record<string, unknown> } {
    const [header, ...lines] = toml.split('\n');
    const values = Object.fromEntries(
        lines.map((line) => {
            const [key, value] = line.split(/ = (.*)/s);
            return [key, JSON.parse(value)];
        }),
    );
    return { table: header, values };
}

/** Splits a POSIX shell line the way sh does for single-quoted words. */
function posixWords(line: string): string[] {
    return [...line.matchAll(/'((?:[^']|'\\'')*)'|(\S+)/g)].map((m) =>
        m[1] !== undefined ? m[1].replaceAll("'\\''", "'") : m[2],
    );
}

function setup(launch: McpLaunchCommand, id: McpClientId): McpClientSetup {
    const found = buildMcpClientSetups(launch, URL).find((s) => s.id === id);
    if (!found) throw new Error(`No setup ${id}`);
    return found;
}

describe('buildMcpClientSetups', () => {
    it('offers one tab per client, in this order', () => {
        expect(buildMcpClientSetups(DEB, URL).map((s) => s.id)).toEqual([
            'claude-code',
            'codex',
            'claude-desktop',
            'other',
        ]);
    });

    it('recommends HTTP for Claude Code, for every project', () => {
        const claudeCode = setup(DEB, 'claude-code');
        expect(claudeCode.recommended).toMatchObject({
            method: 'http',
            code: 'claude mcp add --transport http --scope user wmb-table http://127.0.0.1:23133/mcp',
        });
        expect(claudeCode.alternative).toMatchObject({
            method: 'command',
            code: "claude mcp add --scope user wmb-table -- '/opt/Wmb Table/wmb-table' mcp",
        });
    });

    it('recommends the Codex url table, with the command table as the other way', () => {
        const codex = setup(DEB, 'codex');
        expect(codex.recommended).toMatchObject({
            method: 'http',
            code: '[mcp_servers.wmb-table]\nurl = "http://127.0.0.1:23133/mcp"',
        });
        expect(codex.alternative.method).toBe('command');
    });

    it('recommends the command for Claude Desktop, and mcp-remote for the URL', () => {
        const desktop = setup(DEB, 'claude-desktop');
        expect(desktop.recommended.method).toBe('command');
        expect(JSON.parse(desktop.recommended.code)).toEqual({
            mcpServers: { 'wmb-table': { command: DEB.command, args: ['mcp'] } },
        });
        expect(desktop.recommended.hint).not.toContain('Node.js');
        expect(JSON.parse(desktop.alternative.code)).toEqual({
            mcpServers: { 'wmb-table': { command: 'npx', args: ['-y', 'mcp-remote', URL] } },
        });
        expect(desktop.alternative.hint).toContain('Node.js');
    });

    it('gives other apps the URL and the bare command line', () => {
        const other = setup(DEB, 'other');
        expect(other.recommended).toMatchObject({ method: 'http', code: URL });
        expect(other.alternative).toMatchObject({
            method: 'command',
            code: "'/opt/Wmb Table/wmb-table' mcp",
        });
    });

    it('leaves a path without special characters unquoted', () => {
        expect(setup(APPIMAGE, 'claude-code').alternative.code).toBe(
            'claude mcp add --scope user wmb-table -- /home/marie/Applications/Wmb-Table-2.0.0.AppImage mcp',
        );
    });

    it('uses double quotes and keeps backslashes for a Windows path in the shell', () => {
        expect(setup(WINDOWS, 'claude-code').alternative.code).toBe(
            'claude mcp add --scope user wmb-table -- "C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\Wmb Table.exe" mcp',
        );
    });

    it.each([
        ['deb', DEB],
        ['AppImage', APPIMAGE],
        ['Windows', WINDOWS],
        ['macOS', MAC],
        ['dev', DEV],
    ])('gives Claude Desktop the exact command and args (%s)', (_name, launch) => {
        expect(JSON.parse(setup(launch, 'claude-desktop').recommended.code)).toEqual({
            mcpServers: {
                'wmb-table': { command: launch.command, args: [...launch.args, 'mcp'] },
            },
        });
    });

    it('escapes Windows backslashes in JSON', () => {
        expect(setup(WINDOWS, 'claude-desktop').recommended.code).toContain(
            '"command": "C:\\\\Users\\\\Marie\\\\AppData\\\\Local\\\\Programs\\\\wmb-table\\\\Wmb Table.exe"',
        );
    });

    it.each([
        ['deb', DEB],
        ['Windows', WINDOWS],
        ['macOS', MAC],
        ['dev', DEV],
    ])('writes a Codex command table that reads back to the same command (%s)', (_name, launch) => {
        const parsed = parseCodexTable(setup(launch, 'codex').alternative.code);
        expect(parsed.table).toBe('[mcp_servers.wmb-table]');
        expect(parsed.values).toEqual({ command: launch.command, args: [...launch.args, 'mcp'] });
    });

    it('starts a development checkout through Electron with the app folder', () => {
        expect(setup(DEV, 'claude-code').alternative.code).toBe(
            'claude mcp add --scope user wmb-table -- /home/dev/wmb-table/node_modules/electron/dist/electron /home/dev/wmb-table mcp',
        );
    });
});

describe('quoteShellArgument', () => {
    it.each(["/home/o'brien/Wmb Table.AppImage", '/opt/Wmb Table/wmb-table', '/tmp/$HOME `x` "y"'])(
        'round-trips %s through a POSIX shell line',
        (path) => {
            expect(posixWords(`${quoteShellArgument(path, 'linux')} mcp`)).toEqual([path, 'mcp']);
        },
    );

    it('quotes a macOS bundle path', () => {
        expect(quoteShellArgument(MAC.command, 'darwin')).toBe(
            "'/Applications/Wmb Table.app/Contents/MacOS/Wmb Table'",
        );
    });
});

describe('buildHeadlessStartCommand', () => {
    it('starts the HTTP server on the configured port', () => {
        expect(buildHeadlessStartCommand(DEB, 23132)).toBe(
            "'/opt/Wmb Table/wmb-table' mcp --http --port 23132",
        );
    });

    it('uses the PowerShell call operator for a quoted Windows path', () => {
        expect(buildHeadlessStartCommand(WINDOWS, 23132)).toBe(
            '& "C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\Wmb Table.exe" mcp --http --port 23132',
        );
    });
});

describe('setup texts', () => {
    const texts = buildMcpClientSetups(DEB, URL).flatMap((s) => [
        s.label,
        s.recommended.hint,
        s.alternative.hint,
    ]);

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('every label and hint is translated in %s', (_name, locale) => {
        const translatable = texts.filter(
            (text) => !['Claude Code', 'Codex', 'Claude Desktop'].includes(text),
        );
        expect(translatable.filter((text) => !locale[text])).toEqual([]);
    });
});
