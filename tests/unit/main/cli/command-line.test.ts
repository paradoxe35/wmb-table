import { describe, expect, it } from 'vitest';
import {
    HEADLESS_SWITCHES,
    parseCliCommand,
    planHeadlessRelaunch,
    userArguments,
} from '@main/cli/command-line';

const PACKAGED = '/opt/Wmb Table/wmb-table';
const APPIMAGE_MOUNT = '/tmp/.mount_Wmb-TaXyZ12/wmb-table';
const ELECTRON = '/src/wmb-table/node_modules/electron/dist/electron';

function parse(argv: string[], defaultApp = false) {
    return parseCliCommand(userArguments(argv, defaultApp));
}

describe('userArguments', () => {
    it('drops only the executable in a packaged app', () => {
        expect(userArguments([PACKAGED, 'mcp', '--http'], false)).toEqual(['mcp', '--http']);
    });

    it('also drops the app folder when Electron runs a checkout', () => {
        expect(userArguments([ELECTRON, '.', 'mcp'], true)).toEqual(['mcp']);
    });

    it('keeps Chromium switches that come before the app folder', () => {
        expect(userArguments([ELECTRON, '--no-sandbox', '.', 'mcp'], true)).toEqual([
            '--no-sandbox',
            'mcp',
        ]);
    });
});

describe('parseCliCommand', () => {
    it.each([
        ['no arguments', [PACKAGED]],
        ['only Chromium switches', [PACKAGED, '--no-sandbox', '--remote-debugging-port=9222']],
        ['another word', [PACKAGED, 'notes.docx']],
    ])('opens the app for %s', (_name, argv) => {
        expect(parse(argv)).toEqual({ kind: 'gui' });
    });

    it('opens the app for a development launch without a command', () => {
        expect(parse([ELECTRON, '.', '--no-sandbox'], true)).toEqual({ kind: 'gui' });
    });

    it('serves over stdio by default', () => {
        expect(parse([PACKAGED, 'mcp'])).toEqual({ kind: 'mcp', transport: 'stdio' });
    });

    it('reads the same command from a development launch', () => {
        expect(parse([ELECTRON, '.', 'mcp'], true)).toEqual({ kind: 'mcp', transport: 'stdio' });
    });

    it('reads the same command from an AppImage', () => {
        expect(parse([APPIMAGE_MOUNT, 'mcp', '--language', 'fr'])).toEqual({
            kind: 'mcp',
            transport: 'stdio',
            language: 'fr',
        });
    });

    it('serves over HTTP with an exact port, in both option forms', () => {
        const expected = { kind: 'mcp', transport: 'http', port: 23140 };
        expect(parse([PACKAGED, 'mcp', '--http', '--port', '23140'])).toEqual(expected);
        expect(parse([PACKAGED, 'mcp', '--port=23140', '--http'])).toEqual(expected);
    });

    it('accepts --language=code', () => {
        expect(parse([PACKAGED, 'mcp', '--http', '--language=pt'])).toMatchObject({
            transport: 'http',
            language: 'pt',
        });
    });

    it('ignores the switches its own relaunch adds', () => {
        expect(parse([PACKAGED, 'mcp', '--http', ...HEADLESS_SWITCHES])).toEqual({
            kind: 'mcp',
            transport: 'http',
        });
    });

    it.each(['-h', '--help'])('shows the help for %s', (flag) => {
        expect(parse([PACKAGED, 'mcp', flag])).toEqual({ kind: 'help' });
    });

    it.each([
        [['--verbose'], 'Unknown option "--verbose".'],
        [['--http=yes'], 'Unknown option "--http=yes".'],
        [['extra'], 'Unknown option "extra".'],
        [['--port', '23140'], '--port only works with --http.'],
        [['--http', '--port'], '--port needs a value.'],
        [['--http', '--port', '--language', 'fr'], '--port needs a value.'],
        [['--http', '--port', 'abc'], '--port must be a number from 1024 to 65535.'],
        [['--http', '--port', '80'], '--port must be a number from 1024 to 65535.'],
        [['--http', '--port', '70000'], '--port must be a number from 1024 to 65535.'],
        [['--language'], '--language needs a value.'],
        [['--language='], '--language needs a value.'],
        [['--language', 'fr; rm'], '"fr; rm" is not a language code.'],
    ])('refuses %j with a clear message', (options, message) => {
        expect(parse([PACKAGED, 'mcp', ...options])).toEqual({ kind: 'invalid', message });
    });
});

describe('planHeadlessRelaunch', () => {
    it('relaunches a Linux MCP command with the headless switches', () => {
        expect(
            planHeadlessRelaunch({
                argv: [PACKAGED, 'mcp', '--http'],
                platform: 'linux',
                defaultApp: false,
            }),
        ).toEqual(['mcp', '--http', ...HEADLESS_SWITCHES]);
    });

    it('keeps the app folder of a development launch', () => {
        expect(
            planHeadlessRelaunch({
                argv: [ELECTRON, '.', 'mcp'],
                platform: 'linux',
                defaultApp: true,
            }),
        ).toEqual(['.', 'mcp', ...HEADLESS_SWITCHES]);
    });

    it('does not relaunch the relaunched child', () => {
        expect(
            planHeadlessRelaunch({
                argv: [PACKAGED, 'mcp', ...HEADLESS_SWITCHES],
                platform: 'linux',
                defaultApp: false,
            }),
        ).toBeNull();
    });

    it('does not relaunch when the user already asked for headless Ozone', () => {
        expect(
            planHeadlessRelaunch({
                argv: [PACKAGED, '--ozone-platform=headless', 'mcp'],
                platform: 'linux',
                defaultApp: false,
            }),
        ).toBeNull();
    });

    it.each(['darwin', 'win32'] as const)('needs no relaunch on %s', (platform) => {
        expect(
            planHeadlessRelaunch({ argv: [PACKAGED, 'mcp'], platform, defaultApp: false }),
        ).toBeNull();
    });

    it.each([
        ['the app', [PACKAGED]],
        ['help', [PACKAGED, 'mcp', '--help']],
        ['an invalid command', [PACKAGED, 'mcp', '--nope']],
    ])('does not relaunch for %s', (_name, argv) => {
        expect(planHeadlessRelaunch({ argv, platform: 'linux', defaultApp: false })).toBeNull();
    });
});
