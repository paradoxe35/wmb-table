import { describe, expect, it } from 'vitest';
import { detectMcpLaunchCommand } from '@main/services/mcp/mcp-launch-command';

describe('detectMcpLaunchCommand', () => {
    it('uses the installed binary of a .deb, spaces included', () => {
        expect(
            detectMcpLaunchCommand({
                platform: 'linux',
                execPath: '/opt/Wmb Table/wmb-table',
                isPackaged: true,
                appPath: '/opt/Wmb Table/resources/app.asar',
            }),
        ).toEqual({ command: '/opt/Wmb Table/wmb-table', args: [], platform: 'linux', dev: false });
    });

    it('uses the .AppImage file, not its temporary mount', () => {
        expect(
            detectMcpLaunchCommand({
                platform: 'linux',
                execPath: '/tmp/.mount_Wmb-TaXyZ12/wmb-table',
                isPackaged: true,
                appPath: '/tmp/.mount_Wmb-TaXyZ12/resources/app.asar',
                appImage: '/home/marie/Applications/Wmb Table-2.0.0.AppImage',
            }),
        ).toMatchObject({ command: '/home/marie/Applications/Wmb Table-2.0.0.AppImage', args: [] });
    });

    it('uses the installed Windows .exe', () => {
        const exe = 'C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\Wmb Table.exe';
        expect(
            detectMcpLaunchCommand({
                platform: 'win32',
                execPath: exe,
                isPackaged: true,
                appPath:
                    'C:\\Users\\Marie\\AppData\\Local\\Programs\\wmb-table\\resources\\app.asar',
                appImage: 'ignored',
            }),
        ).toEqual({ command: exe, args: [], platform: 'win32', dev: false });
    });

    it('uses the binary inside the macOS bundle', () => {
        expect(
            detectMcpLaunchCommand({
                platform: 'darwin',
                execPath: '/Applications/Wmb Table.app/Contents/MacOS/Wmb Table',
                isPackaged: true,
                appPath: '/Applications/Wmb Table.app/Contents/Resources/app.asar',
            }),
        ).toEqual({
            command: '/Applications/Wmb Table.app/Contents/MacOS/Wmb Table',
            args: [],
            platform: 'darwin',
            dev: false,
        });
    });

    it('starts a development checkout through Electron with the app folder', () => {
        expect(
            detectMcpLaunchCommand({
                platform: 'linux',
                execPath: '/src/wmb-table/node_modules/electron/dist/electron',
                isPackaged: false,
                appPath: '/src/wmb-table',
            }),
        ).toEqual({
            command: '/src/wmb-table/node_modules/electron/dist/electron',
            args: ['/src/wmb-table'],
            platform: 'linux',
            dev: true,
        });
    });

    it('keeps other systems usable with POSIX quoting', () => {
        expect(
            detectMcpLaunchCommand({
                platform: 'freebsd',
                execPath: '/usr/local/bin/wmb-table',
                isPackaged: true,
                appPath: '/x',
            }).platform,
        ).toBe('other');
    });
});
