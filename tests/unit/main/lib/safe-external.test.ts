import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternalMock = vi.fn();
const warnMock = vi.fn();

vi.mock('electron', () => ({ shell: { openExternal: openExternalMock } }));
vi.mock('@main/lib/logger', () => ({ default: { warn: warnMock } }));

const { isAppPageNavigation, openExternalSafely, secureWindowNavigation } =
    await import('@main/lib/safe-external');

const APP_FILE_URL = 'file:///opt/Wmb%20Table/resources/app.asar/out/renderer/index.html';
const DEV_SERVER_URL = 'http://localhost:5173';

type WindowOpenHandler = (details: { url: string }) => { action: string };
type NavigationListener = (event: { preventDefault: () => void }, url: string) => void;

function createFakeWebContents() {
    let windowOpenHandler: WindowOpenHandler | undefined;
    let navigationListener: NavigationListener | undefined;
    const webContents = {
        setWindowOpenHandler: (handler: WindowOpenHandler) => {
            windowOpenHandler = handler;
        },
        on: (eventName: string, listener: NavigationListener) => {
            if (eventName === 'will-navigate') navigationListener = listener;
        },
    };
    return {
        webContents,
        openWindow: (url: string) => windowOpenHandler!({ url }),
        navigate: (url: string) => {
            const event = { preventDefault: vi.fn() };
            navigationListener!(event, url);
            return event.preventDefault.mock.calls.length > 0;
        },
    };
}

function loggedText(): string {
    return warnMock.mock.calls.flat().map(String).join('\n');
}

beforeEach(() => {
    vi.clearAllMocks();
    openExternalMock.mockResolvedValue(undefined);
});

describe('openExternalSafely', () => {
    it('opens web and mail links with the normalized URL', async () => {
        await expect(openExternalSafely(' HTTPS://Example.com/a ', 'ipc')).resolves.toBe(true);
        await expect(openExternalSafely('mailto:a@b.c', 'ipc')).resolves.toBe(true);

        expect(openExternalMock.mock.calls).toEqual([['https://example.com/a'], ['mailto:a@b.c']]);
        expect(warnMock).not.toHaveBeenCalled();
    });

    it.each([
        'file:///C:/Windows/System32/calc.exe',
        'javascript:alert(1)',
        'data:text/html,hi',
        '../../calc.exe',
        'wmb://sermon/x/fr/1/1',
        'smb://server/share',
    ])('refuses %s and logs only its scheme', async (url) => {
        await expect(openExternalSafely(url, 'window-open')).resolves.toBe(false);

        expect(openExternalMock).not.toHaveBeenCalled();
        expect(warnMock).toHaveBeenCalledTimes(1);
        expect(loggedText()).toContain('window-open');
        expect(loggedText()).not.toContain(url);
    });

    it('does not log the token of a refused URL', async () => {
        await openExternalSafely('ftp://user:s3cr3t-token@example.com/?key=abc123', 'ipc');

        expect(loggedText()).toContain('ftp:');
        expect(loggedText()).not.toMatch(/s3cr3t|abc123|example\.com/);
    });

    it('refuses values that are not strings', async () => {
        await expect(openExternalSafely({ url: 'https://a.b' }, 'ipc')).resolves.toBe(false);
        await expect(openExternalSafely(undefined, 'ipc')).resolves.toBe(false);
        expect(openExternalMock).not.toHaveBeenCalled();
    });

    it('passes on an error from the OS', async () => {
        openExternalMock.mockRejectedValue(new Error('no handler'));
        await expect(openExternalSafely('https://example.com', 'ipc')).rejects.toThrow(
            'no handler',
        );
    });
});

describe('isAppPageNavigation', () => {
    it.each([APP_FILE_URL, `${APP_FILE_URL}#/settings`, `${APP_FILE_URL}?reload=1`])(
        'allows the app page itself: %s',
        (url) => {
            expect(isAppPageNavigation(url, APP_FILE_URL)).toBe(true);
        },
    );

    it.each([
        'file:///opt/Wmb%20Table/resources/app.asar/out/renderer/other.html',
        'file:///C:/Windows/System32/calc.exe',
        'file://evil-host/opt/Wmb%20Table/resources/app.asar/out/renderer/index.html',
        'https://example.com/',
        'javascript:alert(1)',
        'not a url',
    ])('refuses %s in production', (url) => {
        expect(isAppPageNavigation(url, APP_FILE_URL)).toBe(false);
    });

    it('allows any page of the dev server and nothing else', () => {
        expect(isAppPageNavigation('http://localhost:5173/', DEV_SERVER_URL)).toBe(true);
        expect(isAppPageNavigation('http://localhost:5173/src/main.tsx', DEV_SERVER_URL)).toBe(
            true,
        );
        expect(isAppPageNavigation('http://localhost:5174/', DEV_SERVER_URL)).toBe(false);
        expect(isAppPageNavigation('https://localhost:5173/', DEV_SERVER_URL)).toBe(false);
        expect(isAppPageNavigation(APP_FILE_URL, DEV_SERVER_URL)).toBe(false);
    });
});

describe('secureWindowNavigation', () => {
    it('sends safe window-open links to the OS and always denies the new window', async () => {
        const fake = createFakeWebContents();
        secureWindowNavigation(fake.webContents as never, APP_FILE_URL);

        expect(fake.openWindow('https://wmb-table.web.app/')).toEqual({ action: 'deny' });
        await vi.waitFor(() =>
            expect(openExternalMock).toHaveBeenCalledWith('https://wmb-table.web.app/'),
        );
    });

    it('denies unsafe window-open links without opening them', async () => {
        const fake = createFakeWebContents();
        secureWindowNavigation(fake.webContents as never, APP_FILE_URL);

        expect(fake.openWindow('file:///C:/Windows/System32/calc.exe')).toEqual({
            action: 'deny',
        });
        expect(fake.openWindow('javascript:alert(1)')).toEqual({ action: 'deny' });
        await Promise.resolve();

        expect(openExternalMock).not.toHaveBeenCalled();
        expect(warnMock).toHaveBeenCalledTimes(2);
    });

    it('logs instead of throwing when the OS cannot open a link', async () => {
        openExternalMock.mockRejectedValue(new Error('no handler'));
        const fake = createFakeWebContents();
        secureWindowNavigation(fake.webContents as never, APP_FILE_URL);

        fake.openWindow('https://example.com/');
        await vi.waitFor(() => expect(warnMock).toHaveBeenCalledTimes(1));
    });

    it('blocks navigation away from the app page', () => {
        const fake = createFakeWebContents();
        secureWindowNavigation(fake.webContents as never, APP_FILE_URL);

        expect(fake.navigate('https://example.com/')).toBe(true);
        expect(fake.navigate('file:///etc/passwd')).toBe(true);
        expect(fake.navigate(APP_FILE_URL)).toBe(false);
        expect(openExternalMock).not.toHaveBeenCalled();
        expect(loggedText()).not.toContain('example.com');
    });

    it('lets the dev server page reload in development', () => {
        const fake = createFakeWebContents();
        secureWindowNavigation(fake.webContents as never, DEV_SERVER_URL);

        expect(fake.navigate('http://localhost:5173/')).toBe(false);
        expect(fake.navigate('http://127.0.0.1:9999/')).toBe(true);
    });
});
