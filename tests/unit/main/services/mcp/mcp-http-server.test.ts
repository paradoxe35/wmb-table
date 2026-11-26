import { request } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import { startMcpHttpServer, type McpHttpServer } from '@main/services/mcp/mcp-http-server';
import { MCP_HOST } from '@shared/mcp.types';
import { freeLoopbackPort } from '../../../../helpers/free-port';

const LEGACY_INITIALIZE = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'legacy-client', version: '1.0.0' },
    },
};

let server: McpHttpServer | null = null;

function emptyLibrary(): McpServer {
    const mcp = new McpServer({ name: 'test', version: '1.0.0' });
    mcp.registerTool('ping', { description: 'Ping' }, async () => ({
        content: [{ type: 'text', text: 'pong' }],
    }));
    return mcp;
}

async function start(): Promise<McpHttpServer> {
    server = await startMcpHttpServer({
        firstPort: await freeLoopbackPort(),
        createServer: emptyLibrary,
    });
    return server;
}

interface RawResponse {
    status: number;
    body: string;
}

function post(
    port: number,
    headers: Record<string, string>,
    body: unknown = LEGACY_INITIALIZE,
    path = '/mcp',
): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
        const req = request(
            {
                host: MCP_HOST,
                port,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/event-stream',
                    ...headers,
                },
            },
            (res) => {
                let text = '';
                res.on('data', (chunk) => (text += chunk));
                res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
            },
        );
        req.on('error', reject);
        req.end(JSON.stringify(body));
    });
}

afterEach(async () => {
    await server?.close();
    server = null;
});

describe('startMcpHttpServer', () => {
    it('serves on 127.0.0.1 and shows the URL with the port', async () => {
        const started = await start();
        expect(started.url).toBe(`http://127.0.0.1:${started.port}/mcp`);
    });

    it.each([
        ['no Origin (desktop clients)', {}],
        ['Host localhost', { Host: 'localhost' }],
    ])('accepts a request with %s', async (_label, headers) => {
        const { port } = await start();
        const response = await post(port, headers);
        expect(response.status).toBe(200);
        expect(response.body).toContain('"protocolVersion"');
    });

    it.each([
        ['Origin https://evil.example', { Origin: 'https://evil.example' }],
        [
            'Origin http://localhost:5173 (a local dev server page)',
            { Origin: 'http://localhost:5173' },
        ],
        ['Origin http://127.0.0.1:8080', { Origin: 'http://127.0.0.1:8080' }],
        ['Origin http://127.0.0.1', { Origin: 'http://127.0.0.1' }],
        ['Origin null (sandboxed page)', { Origin: 'null' }],
        ['Host evil.example (DNS rebinding)', { Host: 'evil.example' }],
        ['Host evil.example with a local port', { Host: 'evil.example:23132' }],
    ])('refuses a request with %s', async (_label, headers) => {
        const { port } = await start();
        const response = await post(port, headers);
        expect(response.status).toBe(403);
    });

    it('answers 404 outside the MCP path', async () => {
        const { port } = await start();
        expect((await post(port, {}, LEGACY_INITIALIZE, '/other')).status).toBe(404);
    });

    it('serves a 2025-era client without sessions', async () => {
        const { port } = await start();
        const init = await post(port, {});
        expect(init.body).toContain('2025-06-18');

        const list = await post(
            port,
            { 'MCP-Protocol-Version': '2025-06-18' },
            { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        );
        expect(list.status).toBe(200);
        expect(list.body).toContain('"ping"');
    });

    it('stops accepting connections once closed', async () => {
        const { port } = await start();
        await server?.close();
        server = null;
        await expect(post(port, {})).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    });
});
