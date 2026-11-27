import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpChannels } from '@shared/ipc.types';

const registerHandlerMock = vi.fn();
const service = {
    getMcpServerStatus: vi.fn(() => ({ settings: {}, url: null, error: null })),
    updateMcpServerSettings: vi.fn(async (patch: unknown) => ({ patch })),
    currentLaunchCommand: vi.fn(() => ({ command: '/opt/wmb', args: [], platform: 'linux' })),
};
const claudeDesktop = {
    detectClaudeDesktop: vi.fn(async () => ({
        clientId: 'claude-desktop',
        state: 'not-installed',
    })),
    configureClaudeDesktop: vi.fn(async () => ({
        clientId: 'claude-desktop',
        state: 'configured',
    })),
};

vi.mock('@main/ipc/ipc-bridge', () => ({ registerHandler: registerHandlerMock }));
vi.mock('@main/services/mcp/mcp-server.service', () => service);
vi.mock('@main/services/mcp/clients/claude-desktop-client', () => claudeDesktop);

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const { registerMcpHandlers } = await import('@main/ipc/mcp.ipc');
registerMcpHandlers();
const handlers = new Map<string, Handler>(
    registerHandlerMock.mock.calls.map(([channel, handler]) => [channel, handler]),
);
const updateSettings = (patch: unknown) => handlers.get(McpChannels.updateSettings)!({}, patch);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MCP IPC handlers', () => {
    it('returns the server status', async () => {
        await expect(handlers.get(McpChannels.getStatus)!({})).resolves.toEqual({
            settings: {},
            url: null,
            error: null,
        });
    });

    it('passes a valid patch to the service', async () => {
        await updateSettings({ enabled: true, allowWrites: false });
        expect(service.updateMcpServerSettings).toHaveBeenCalledWith({
            enabled: true,
            allowWrites: false,
        });
    });

    it.each([
        ['a port', { port: 80 }],
        ['a non-boolean switch', { enabled: 'yes' }],
        ['no object', null],
    ])('refuses a patch with %s', async (_label, patch) => {
        await expect(updateSettings(patch)).rejects.toThrow('Invalid MCP server settings');
        expect(service.updateMcpServerSettings).not.toHaveBeenCalled();
    });

    it('detects Claude Desktop with paths computed in main', async () => {
        await expect(handlers.get(McpChannels.detectClients)!({})).resolves.toEqual([
            { clientId: 'claude-desktop', state: 'not-installed' },
        ]);
        expect(claudeDesktop.detectClaudeDesktop).toHaveBeenCalledWith(
            expect.objectContaining({ platform: process.platform, launch: expect.anything() }),
        );
    });

    it('configures Claude Desktop', async () => {
        await handlers.get(McpChannels.configureClient)!({}, { clientId: 'claude-desktop' });
        expect(claudeDesktop.configureClaudeDesktop).toHaveBeenCalledOnce();
    });

    it.each([
        ['another app', { clientId: 'cursor' }],
        ['a path', { clientId: 'claude-desktop', path: '/etc/passwd' }],
        ['no object', null],
    ])('refuses to configure %s', async (_label, request) => {
        await expect(handlers.get(McpChannels.configureClient)!({}, request)).rejects.toThrow(
            'Invalid MCP client',
        );
        expect(claudeDesktop.configureClaudeDesktop).not.toHaveBeenCalled();
    });
});
