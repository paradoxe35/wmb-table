import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createMcpHandler, type McpServerFactory } from '@modelcontextprotocol/server';
import { localhostHostValidation, toNodeHandler } from '@modelcontextprotocol/node';
import log from '@main/lib/logger';
import { MCP_HOST, MCP_PATH, MCP_PORT_ATTEMPTS, buildMcpUrl } from '@shared/mcp.types';
import { listenOnFreePort } from './listen-on-free-port';

export interface McpHttpServer {
    port: number;
    url: string;
    close(): Promise<void>;
}

export interface McpHttpServerOptions {
    firstPort: number;
    /** How many ports from `firstPort` on to try; 1 means exactly that port. */
    portAttempts?: number;
    createServer: McpServerFactory;
}

function isMcpPath(req: IncomingMessage): boolean {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    return pathname === MCP_PATH;
}

/**
 * Native MCP clients send no Origin; any web page does, even one served from localhost
 * (a dev server on another port), so every request with an Origin is refused.
 */
function refuseBrowserRequest(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.headers.origin === undefined) return false;
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Browser requests are not allowed');
    return true;
}

function notFound(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
}

/**
 * Stateless Streamable HTTP on loopback only. The Host check stops DNS rebinding and
 * refusing any Origin stops web pages, so no token is needed for a library that is not secret.
 */
export async function startMcpHttpServer(options: McpHttpServerOptions): Promise<McpHttpServer> {
    const handler = createMcpHandler(options.createServer, {
        onerror: (error) => log.warn('[mcp] Request failed:', error),
    });
    const handleMcpRequest = toNodeHandler(handler);
    const validateHost = localhostHostValidation();

    const server = createServer((req, res) => {
        if (!validateHost(req, res) || refuseBrowserRequest(req, res)) return;
        if (!isMcpPath(req)) return notFound(res);
        handleMcpRequest(req, res).catch((error: unknown) => {
            log.warn('[mcp] Request failed:', error);
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
    });

    const port = await listenOnFreePort(
        server,
        MCP_HOST,
        options.firstPort,
        options.portAttempts ?? MCP_PORT_ATTEMPTS,
    );

    return {
        port,
        url: buildMcpUrl(port),
        close: async () => {
            await handler.close();
            await new Promise<void>((resolve) => {
                server.close(() => resolve());
                server.closeAllConnections();
            });
        },
    };
}
