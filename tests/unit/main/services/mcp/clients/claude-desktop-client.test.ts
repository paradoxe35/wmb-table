import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpLaunchCommand } from '@shared/mcp.types';
import {
    claudeDesktopConfigDir,
    configureClaudeDesktop,
    detectClaudeDesktop,
    type ClaudeDesktopContext,
} from '@main/services/mcp/clients/claude-desktop-client';

const LINUX_LAUNCH: McpLaunchCommand = {
    command: '/opt/Wmb Table/wmb-table',
    args: [],
    platform: 'linux',
    dev: false,
};
const MAC_LAUNCH: McpLaunchCommand = {
    command: '/Applications/Wmb Table.app/Contents/MacOS/Wmb Table',
    args: [],
    platform: 'darwin',
    dev: false,
};
const OUR_ENTRY = { command: LINUX_LAUNCH.command, args: ['--no-sandbox', 'mcp'] };
const NOW = new Date('2026-11-26T10:20:30.456Z');
const BACKUP_SUFFIX = '.wmb-table-backup-2026-11-26T10-20-30-456Z';

let home: string;
let claudeDir: string;
let configFile: string;

function context(launch = LINUX_LAUNCH): ClaudeDesktopContext {
    return { platform: 'linux', homeDir: home, env: {}, launch, now: () => NOW };
}

function installClaude(text?: string): void {
    mkdirSync(claudeDir, { recursive: true });
    if (text !== undefined) writeFileSync(configFile, text);
}

const readConfig = () => JSON.parse(readFileSync(configFile, 'utf8'));
const filesInClaudeDir = () => readdirSync(claudeDir).sort();

beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'wmb-claude-desktop-'));
    claudeDir = join(home, '.config', 'Claude');
    configFile = join(claudeDir, 'claude_desktop_config.json');
});

afterEach(() => {
    rmSync(home, { recursive: true, force: true });
});

describe('claudeDesktopConfigDir', () => {
    it.each([
        [
            'win32',
            { APPDATA: 'C:\\Users\\Marie\\AppData\\Roaming' },
            'C:\\Users\\Marie',
            'C:\\Users\\Marie\\AppData\\Roaming\\Claude',
        ],
        ['win32', {}, 'C:\\Users\\Marie', 'C:\\Users\\Marie\\AppData\\Roaming\\Claude'],
        ['darwin', {}, '/Users/marie', '/Users/marie/Library/Application Support/Claude'],
        ['linux', {}, '/home/marie', '/home/marie/.config/Claude'],
        ['linux', { XDG_CONFIG_HOME: '/data/config' }, '/home/marie', '/data/config/Claude'],
    ] as const)('on %s with %j', (platform, env, homeDir, expected) => {
        expect(claudeDesktopConfigDir({ platform, homeDir, env })).toBe(expected);
    });

    it('knows no folder on other systems', () => {
        expect(
            claudeDesktopConfigDir({ platform: 'freebsd', homeDir: '/home/m', env: {} }),
        ).toBeNull();
    });
});

describe('Claude Desktop not installed', () => {
    it('is detected as not installed and nothing is created', async () => {
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'not-installed',
            configPath: null,
        });
        expect(await configureClaudeDesktop(context())).toMatchObject({ state: 'not-installed' });
        expect(readdirSync(home)).toEqual([]);
    });
});

describe('Claude Desktop installed', () => {
    it('without a config file: writes a new one with only our entry, no backup', async () => {
        installClaude();
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'not-configured',
            configPath: configFile,
        });
        expect(await configureClaudeDesktop(context())).toMatchObject({
            state: 'configured',
            upToDate: true,
        });
        expect(readConfig()).toEqual({ mcpServers: { 'wmb-table': OUR_ENTRY } });
        expect(filesInClaudeDir()).toEqual(['claude_desktop_config.json']);
    });

    it('treats an empty file as an empty configuration', async () => {
        installClaude('');
        await configureClaudeDesktop(context());
        expect(readConfig()).toEqual({ mcpServers: { 'wmb-table': OUR_ENTRY } });
    });

    it('keeps every other key and server, their order and the indent, after a backup', async () => {
        const original = `{
    "globalShortcut": "Ctrl+Space",
    "mcpServers": {
        "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/m"] }
    },
    "preferences": { "menuBarEnabled": false }
}
`;
        installClaude(original);
        expect(await detectClaudeDesktop(context())).toMatchObject({ state: 'not-configured' });
        await configureClaudeDesktop(context());

        const written = readFileSync(configFile, 'utf8');
        expect(JSON.parse(written)).toEqual({
            globalShortcut: 'Ctrl+Space',
            mcpServers: {
                filesystem: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/m'],
                },
                'wmb-table': OUR_ENTRY,
            },
            preferences: { menuBarEnabled: false },
        });
        expect(Object.keys(JSON.parse(written))).toEqual([
            'globalShortcut',
            'mcpServers',
            'preferences',
        ]);
        expect(written).toMatch(/^ {4}"globalShortcut"/m);
        expect(written.endsWith('}\n')).toBe(true);
        expect(readFileSync(configFile + BACKUP_SUFFIX, 'utf8')).toBe(original);
        expect(filesInClaudeDir()).toEqual([
            'claude_desktop_config.json',
            `claude_desktop_config.json${BACKUP_SUFFIX}`,
        ]);
    });

    it('is idempotent: a second run writes nothing and makes no second backup', async () => {
        installClaude('{"mcpServers": {"other": {"command": "x"}}}');
        await configureClaudeDesktop(context());
        const afterFirst = readFileSync(configFile, 'utf8');
        const later = { ...context(), now: () => new Date('2026-11-27T00:00:00.000Z') };
        expect(await configureClaudeDesktop(later)).toMatchObject({
            state: 'configured',
            upToDate: true,
        });
        expect(readFileSync(configFile, 'utf8')).toBe(afterFirst);
        expect(filesInClaudeDir()).toHaveLength(2);
    });

    it('shows our same entry as configured and up to date', async () => {
        installClaude(JSON.stringify({ mcpServers: { 'wmb-table': OUR_ENTRY } }));
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'configured',
            upToDate: true,
        });
    });

    it('updates our entry when it points at another copy, and keeps the others', async () => {
        installClaude(
            JSON.stringify({
                mcpServers: {
                    'wmb-table': { command: '/old/wmb-table', args: ['mcp'] },
                    other: { command: 'x' },
                },
            }),
        );
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'configured',
            upToDate: false,
        });
        await configureClaudeDesktop(context());
        expect(readConfig()).toEqual({
            mcpServers: { 'wmb-table': OUR_ENTRY, other: { command: 'x' } },
        });
    });

    it('writes no --no-sandbox outside Linux', async () => {
        installClaude();
        await configureClaudeDesktop(context(MAC_LAUNCH));
        expect(readConfig().mcpServers['wmb-table']).toEqual({
            command: MAC_LAUNCH.command,
            args: ['mcp'],
        });
    });

    it.each([
        ['broken JSON', '{"mcpServers": {'],
        ['a comment', '{\n  // mine\n  "mcpServers": {}\n}'],
        ['a trailing comma', '{"mcpServers": {"a": {"command": "x"},}}'],
        ['an array', '[]'],
        ['mcpServers as an array', '{"mcpServers": []}'],
    ])('refuses a file with %s and changes nothing', async (_label, text) => {
        installClaude(text);
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'error',
            error: 'malformed',
        });
        expect(await configureClaudeDesktop(context())).toMatchObject({
            state: 'error',
            error: 'malformed',
        });
        expect(readFileSync(configFile, 'utf8')).toBe(text);
        expect(filesInClaudeDir()).toEqual(['claude_desktop_config.json']);
    });

    it.skipIf(process.getuid?.() === 0)(
        'refuses a read-only file and changes nothing',
        async () => {
            const original = '{"mcpServers": {}}';
            installClaude(original);
            chmodSync(configFile, 0o444);
            expect(await configureClaudeDesktop(context())).toMatchObject({
                state: 'error',
                error: 'permission-denied',
            });
            expect(readFileSync(configFile, 'utf8')).toBe(original);
            expect(filesInClaudeDir()).toEqual(['claude_desktop_config.json']);
        },
    );

    it.skipIf(process.getuid?.() === 0)('reports a file it may not read', async () => {
        installClaude('{}');
        chmodSync(configFile, 0o000);
        expect(await detectClaudeDesktop(context())).toMatchObject({
            state: 'error',
            error: 'permission-denied',
        });
    });

    it('keeps the file mode of the original', async () => {
        installClaude('{}');
        chmodSync(configFile, 0o600);
        await configureClaudeDesktop(context());
        expect(statSync(configFile).mode & 0o777).toBe(0o600);
    });
});
