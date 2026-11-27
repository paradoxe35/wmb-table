import { describe, expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => new Set<string>());

vi.mock('electron', () => ({
    app: { getVersion: () => '0.0.0', getAppPath: () => '/app', isPackaged: false, on: vi.fn() },
    ipcMain: { handle: vi.fn() },
}));
vi.mock('@main/ipc/register', () => {
    loaded.add('@main/ipc/register');
    return {};
});
vi.mock('electron-updater', () => {
    loaded.add('electron-updater');
    return {};
});
vi.mock('@main/lib/updater', () => {
    loaded.add('@main/lib/updater');
    return {};
});

/** The command-line modes load the tools without the window's IPC handlers or the updater. */
describe('MCP import chain', () => {
    it.each([
        ['the tool executors', '@main/services/ai/tools'],
        ['the MCP core', '@main/services/mcp/library-mcp-server'],
        ['the MCP HTTP server', '@main/services/mcp/mcp-http-server'],
        ['the command-line runner', '@main/cli/run-mcp-command'],
    ])('%s load no IPC handler and no updater', async (_name, modulePath) => {
        await import(/* @vite-ignore */ modulePath);
        expect([...loaded]).toEqual([]);
    });
});
