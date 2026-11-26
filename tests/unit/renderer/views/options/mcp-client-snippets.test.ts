import { describe, expect, it } from 'vitest';
import en from '@shared/i18n/locales/en';
import es from '@shared/i18n/locales/es';
import pt from '@shared/i18n/locales/pt';
import sw from '@shared/i18n/locales/sw';
import type { McpLaunchCommand } from '@shared/mcp.types';
import {
    buildCommandSnippets,
    buildHeadlessStartCommand,
    buildHttpSnippets,
    quoteShellArgument,
    type McpClientSnippet,
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

function code(snippets: McpClientSnippet[], id: McpClientSnippet['id']): string {
    const found = snippets.find((s) => s.id === id);
    if (!found) throw new Error(`No snippet ${id}`);
    return found.code;
}

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

describe('buildHttpSnippets', () => {
    const snippets = buildHttpSnippets(URL);

    it('gives the Claude Code command for an HTTP server, for every project', () => {
        expect(code(snippets, 'claude-code')).toBe(
            'claude mcp add --transport http --scope user wmb-table http://127.0.0.1:23133/mcp',
        );
    });

    it('gives the Codex config.toml table with the URL', () => {
        expect(code(snippets, 'codex')).toBe(
            '[mcp_servers.wmb-table]\nurl = "http://127.0.0.1:23133/mcp"',
        );
    });

    it('gives Claude Desktop a stdio bridge to the URL', () => {
        expect(JSON.parse(code(snippets, 'claude-desktop'))).toEqual({
            mcpServers: {
                'wmb-table': { command: 'npx', args: ['-y', 'mcp-remote', URL] },
            },
        });
    });
});

describe('buildCommandSnippets', () => {
    it('quotes a .deb path with a space for the shell', () => {
        expect(code(buildCommandSnippets(DEB), 'claude-code')).toBe(
            "claude mcp add --transport stdio --scope user wmb-table -- '/opt/Wmb Table/wmb-table' mcp",
        );
    });

    it('leaves a path without special characters unquoted', () => {
        expect(code(buildCommandSnippets(APPIMAGE), 'claude-code')).toBe(
            'claude mcp add --transport stdio --scope user wmb-table -- /home/marie/Applications/Wmb-Table-2.0.0.AppImage mcp',
        );
    });

    it('uses double quotes and keeps backslashes for a Windows path in the shell', () => {
        expect(code(buildCommandSnippets(WINDOWS), 'claude-code')).toBe(
            'claude mcp add --transport stdio --scope user wmb-table -- "C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\Wmb Table.exe" mcp',
        );
    });

    it.each([
        ['deb', DEB],
        ['AppImage', APPIMAGE],
        ['Windows', WINDOWS],
        ['macOS', MAC],
        ['dev', DEV],
    ])('gives Claude Desktop the exact command and args (%s)', (_name, launch) => {
        expect(JSON.parse(code(buildCommandSnippets(launch), 'claude-desktop'))).toEqual({
            mcpServers: {
                'wmb-table': { command: launch.command, args: [...launch.args, 'mcp'] },
            },
        });
    });

    it('escapes Windows backslashes in JSON', () => {
        expect(code(buildCommandSnippets(WINDOWS), 'claude-desktop')).toContain(
            '"command": "C:\\\\Users\\\\Marie\\\\AppData\\\\Local\\\\Programs\\\\wmb-table\\\\Wmb Table.exe"',
        );
    });

    it.each([
        ['deb', DEB],
        ['Windows', WINDOWS],
        ['macOS', MAC],
        ['dev', DEV],
    ])('writes a Codex table that reads back to the same command (%s)', (_name, launch) => {
        const parsed = parseCodexTable(code(buildCommandSnippets(launch), 'codex'));
        expect(parsed.table).toBe('[mcp_servers.wmb-table]');
        expect(parsed.values).toEqual({ command: launch.command, args: [...launch.args, 'mcp'] });
    });

    it('starts a development checkout through Electron with the app folder', () => {
        expect(code(buildCommandSnippets(DEV), 'claude-code')).toBe(
            'claude mcp add --transport stdio --scope user wmb-table -- /home/dev/wmb-table/node_modules/electron/dist/electron /home/dev/wmb-table mcp',
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

describe('snippet hints', () => {
    const hints = [...buildHttpSnippets(URL), ...buildCommandSnippets(DEB)].map(
        (snippet) => snippet.hint,
    );

    it.each([
        ['en', en],
        ['es', es],
        ['pt', pt],
        ['sw', sw],
    ])('every hint is translated in %s', (_name, locale) => {
        expect(hints.filter((hint) => !locale[hint])).toEqual([]);
    });
});
