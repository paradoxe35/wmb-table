import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
    shell: { openExternal: vi.fn() },
    app: { getVersion: () => '0.0.0', getName: () => 'test' },
    dialog: { showMessageBox: vi.fn() },
}));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }));
vi.mock('@main/ipc/ipc-bridge', () => ({ sendToRenderer: vi.fn() }));
vi.mock('@main/lib/i18n', () => ({ default: { t: (key: string) => key } }));

import { isDevToolsShortcut } from '@main/lib/menu';

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

function baseInput(): Electron.Input {
    return {
        type: 'keyDown',
        key: 'I',
        code: 'KeyI',
        control: false,
        shift: false,
        alt: false,
        meta: false,
        isAutoRepeat: false,
        isComposing: false,
        location: 0,
        modifiers: [],
    } as unknown as Electron.Input;
}

function press(partial: Partial<Electron.Input>): boolean {
    return isDevToolsShortcut({ ...baseInput(), ...partial } as Electron.Input);
}

afterEach(() => {
    setPlatform(realPlatform);
});

describe('isDevToolsShortcut', () => {
    it('matches Ctrl+Shift+I on Windows and Linux', () => {
        for (const platform of ['win32', 'linux'] as NodeJS.Platform[]) {
            setPlatform(platform);
            expect(press({ control: true, shift: true })).toBe(true);
        }
    });

    it('matches both Command+Shift+I and Control+Shift+I on macOS', () => {
        setPlatform('darwin');

        expect(press({ meta: true, shift: true })).toBe(true);
        expect(press({ control: true, shift: true })).toBe(true);
    });

    it('ignores Command+Shift+I away from macOS', () => {
        setPlatform('win32');

        expect(press({ meta: true, shift: true })).toBe(false);
    });

    it('needs every modifier of the combination', () => {
        setPlatform('win32');

        expect(press({ control: true })).toBe(false);
        expect(press({ shift: true })).toBe(false);
        expect(press({})).toBe(false);
    });

    it('leaves the dev-menu Alt+Ctrl+I combination alone', () => {
        setPlatform('win32');

        expect(press({ control: true, shift: true, alt: true })).toBe(false);
        expect(press({ control: true, alt: true })).toBe(false);
    });

    it('only fires on the way down, so one press toggles once', () => {
        setPlatform('win32');

        expect(press({ control: true, shift: true, type: 'keyUp' })).toBe(false);
    });

    it('follows the physical key, not the character the layout produces', () => {
        setPlatform('win32');

        expect(press({ control: true, shift: true, code: 'KeyI', key: 'ı' })).toBe(true);
        expect(press({ control: true, shift: true, code: 'KeyK', key: 'I' })).toBe(false);
    });
});
