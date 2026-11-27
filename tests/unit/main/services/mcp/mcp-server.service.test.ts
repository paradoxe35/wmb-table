import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createTestDb } from '../../database/test-helpers';
import { freeLoopbackPort, occupyLoopbackPort } from '../../../../helpers/free-port';
import { MCP_PORT_ATTEMPTS } from '@shared/mcp.types';

const factoryCalls: { allowWrites: boolean }[] = [];

vi.mock('electron', () => ({
    app: { getVersion: () => '9.9.9', getAppPath: () => '/work/wmb-table', isPackaged: false },
}));
vi.mock('@main/services/mcp/library-mcp-server', () => ({
    createLibraryMcpServer: (options: { allowWrites: boolean }) => {
        factoryCalls.push(options);
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool(
            options.allowWrites ? 'write' : 'read',
            { description: 'x' },
            async () => ({
                content: [{ type: 'text', text: 'ok' }],
            }),
        );
        return server;
    },
}));

const service = await import('@main/services/mcp/mcp-server.service');
const { loadMcpSettings, saveMcpSettings } = await import('@main/services/mcp/mcp-settings');

const held: { release(): Promise<void> }[] = [];
let firstPort = 0;

async function occupy(port: number): Promise<void> {
    held.push(await occupyLoopbackPort(port));
}

/**
 * fetch keeps sockets alive between clients; right after a restart it could reuse one the old
 * server has just closed, before the client has seen the close.
 */
async function listToolNames(url: string): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    try {
        return (await client.listTools()).tools.map((tool) => tool.name);
    } finally {
        await client.close();
    }
}

beforeEach(async () => {
    createTestDb();
    factoryCalls.length = 0;
    firstPort = await freeLoopbackPort();
    saveMcpSettings({ ...loadMcpSettings(), port: firstPort });
});

afterEach(async () => {
    await service.stopMcpServer();
    await Promise.all(held.splice(0).map((port) => port.release()));
});

describe('MCP server lifecycle', () => {
    it('stays off by default', async () => {
        createTestDb();
        const status = await service.startMcpServerIfEnabled();
        expect(status).toEqual({
            settings: { enabled: false, allowWrites: false, port: 23132 },
            url: null,
            error: null,
            launch: {
                command: process.execPath,
                args: ['/work/wmb-table'],
                platform: process.platform,
                dev: true,
            },
        });
    });

    it('starts when enabled and serves the read tools', async () => {
        const status = await service.updateMcpServerSettings({ enabled: true });
        expect(status.url).toBe(`http://127.0.0.1:${firstPort}/mcp`);
        expect(status.error).toBeNull();
        expect(await listToolNames(status.url!)).toEqual(['read']);
        expect(factoryCalls.at(-1)).toEqual({ allowWrites: false, version: '9.9.9' });
    });

    it('starts at launch when it was enabled before', async () => {
        saveMcpSettings({ enabled: true, allowWrites: false, port: firstPort });
        const status = await service.startMcpServerIfEnabled();
        expect(status.url).toBe(`http://127.0.0.1:${firstPort}/mcp`);
        expect(await listToolNames(status.url!)).toEqual(['read']);
    });

    it('starts once when enabled twice at the same time', async () => {
        const [first, second] = await Promise.all([
            service.updateMcpServerSettings({ enabled: true }),
            service.updateMcpServerSettings({ enabled: true }),
        ]);
        expect(first.url).toBe(`http://127.0.0.1:${firstPort}/mcp`);
        expect(second.url).toBe(first.url);
        expect(service.getMcpServerStatus().settings.port).toBe(firstPort);
    });

    it('stops when disabled, and the URL no longer answers', async () => {
        const { url } = await service.updateMcpServerSettings({ enabled: true });
        const status = await service.updateMcpServerSettings({ enabled: false });
        expect(status.url).toBeNull();
        expect(status.settings.enabled).toBe(false);
        await expect(fetch(url!, { method: 'POST' })).rejects.toThrow();
    });

    it('restarts with the write tools when changes are allowed, on the same port', async () => {
        const before = await service.updateMcpServerSettings({ enabled: true });
        const after = await service.updateMcpServerSettings({ allowWrites: true });
        expect(after.url).toBe(before.url);
        expect(await listToolNames(after.url!)).toEqual(['write']);

        const back = await service.updateMcpServerSettings({ allowWrites: false });
        expect(await listToolNames(back.url!)).toEqual(['read']);
    });

    it('saves the write option without starting the server while it is off', async () => {
        const status = await service.updateMcpServerSettings({ allowWrites: true });
        expect(status.url).toBeNull();
        expect(loadMcpSettings()).toMatchObject({ enabled: false, allowWrites: true });
    });

    it('stopping a server that is not running does nothing', async () => {
        await expect(service.stopMcpServer()).resolves.toBeUndefined();
        await expect(service.stopMcpServer()).resolves.toBeUndefined();
    });

    it('closes the server on quit but keeps it enabled for the next launch', async () => {
        const { url } = await service.updateMcpServerSettings({ enabled: true });
        await service.stopMcpServer();
        expect(service.getMcpServerStatus().url).toBeNull();
        expect(loadMcpSettings().enabled).toBe(true);
        await expect(fetch(url!, { method: 'POST' })).rejects.toThrow();

        const relaunched = await service.startMcpServerIfEnabled();
        expect(relaunched.url).toBe(url);
    });

    it('uses the next port when the remembered one is taken, and remembers it', async () => {
        await occupy(firstPort);
        const status = await service.updateMcpServerSettings({ enabled: true });
        expect(status.url).toBe(`http://127.0.0.1:${firstPort + 1}/mcp`);
        expect(status.settings.port).toBe(firstPort + 1);
        expect(loadMcpSettings().port).toBe(firstPort + 1);
        expect(await listToolNames(status.url!)).toEqual(['read']);
    });

    it('reports a clear error when no port is free, then recovers', async () => {
        for (let offset = 0; offset < MCP_PORT_ATTEMPTS; offset++) {
            await occupy(firstPort + offset).catch(() => undefined);
        }
        const failed = await service.updateMcpServerSettings({ enabled: true });
        expect(failed.url).toBeNull();
        expect(failed.error).toEqual({
            code: 'no-free-port',
            firstPort,
            lastPort: firstPort + MCP_PORT_ATTEMPTS - 1,
        });
        expect(failed.settings.enabled).toBe(true);

        await Promise.all(held.splice(0).map((port) => port.release()));
        const retried = await service.updateMcpServerSettings({ enabled: true });
        expect(retried.error).toBeNull();
        expect(retried.url).toBe(`http://127.0.0.1:${firstPort}/mcp`);
    });

    it('clears the error when the server is turned off', async () => {
        for (let offset = 0; offset < MCP_PORT_ATTEMPTS; offset++) {
            await occupy(firstPort + offset).catch(() => undefined);
        }
        await service.updateMcpServerSettings({ enabled: true });
        const off = await service.updateMcpServerSettings({ enabled: false });
        expect(off.error).toBeNull();
    });
});
