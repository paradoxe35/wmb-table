import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppChannels } from '@shared/ipc.types';

const registerHandlerMock = vi.fn();
const openExternalMock = vi.fn();
const warnMock = vi.fn();
const appMock = { relaunch: vi.fn(), exit: vi.fn(), quit: vi.fn() };

vi.mock('@main/ipc/ipc-bridge', () => ({ registerHandler: registerHandlerMock }));
vi.mock('electron', () => ({
    app: appMock,
    shell: { openExternal: openExternalMock },
}));
vi.mock('@main/lib/logger', () => ({ default: { warn: warnMock } }));
vi.mock('@main/lib/native-theme', () => ({}));
vi.mock('@main/database/repositories/config.repository', () => ({}));
vi.mock('@main/database/repositories/custom-documents.repository', () => ({}));
vi.mock('@main/database/repositories/history.repository', () => ({}));
vi.mock('@main/database/index', () => ({}));
vi.mock('@main/services/bible.service', () => ({}));
vi.mock('@main/services/document-import.service', () => ({}));
vi.mock('@main/lib/updater', () => ({}));
vi.mock('@main/lib/i18n', () => ({ default: {} }));
vi.mock('@main/lib/menu', () => ({ default: vi.fn() }));
vi.mock('@main/lib/window', () => ({ getMainWindow: vi.fn() }));

async function appHandler(
    channel: string,
): Promise<(event: unknown, ...args: unknown[]) => Promise<void>> {
    const { registerAppHandlers } = await import('@main/ipc/app.ipc');
    registerAppHandlers();
    const handler = registerHandlerMock.mock.calls.find(([name]) => name === channel)?.[1];
    expect(handler).toBeTypeOf('function');
    return handler;
}

const openExternalHandler = () => appHandler(AppChannels.openExternal);

describe('app:openExternal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        openExternalMock.mockResolvedValue(undefined);
    });

    it('opens docs and web links', async () => {
        const handler = await openExternalHandler();

        await handler({}, 'https://wmb-table.web.app/en/guide/settings-assistant');
        await handler({}, 'mailto:contact@example.com');

        expect(openExternalMock.mock.calls).toEqual([
            ['https://wmb-table.web.app/en/guide/settings-assistant'],
            ['mailto:contact@example.com'],
        ]);
    });

    it.each(['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', '../calc.exe', 42])(
        'refuses %j without opening anything',
        async (url) => {
            const handler = await openExternalHandler();

            await expect(handler({}, url)).resolves.toBeUndefined();

            expect(openExternalMock).not.toHaveBeenCalled();
            expect(warnMock).toHaveBeenCalledTimes(1);
        },
    );
});

describe('app:restart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('relaunches through the normal quit so services stop in order', async () => {
        const handler = await appHandler(AppChannels.restart);

        await handler({});

        expect(appMock.relaunch).toHaveBeenCalledTimes(1);
        expect(appMock.quit).toHaveBeenCalledTimes(1);
        expect(appMock.exit).not.toHaveBeenCalled();
    });
});
