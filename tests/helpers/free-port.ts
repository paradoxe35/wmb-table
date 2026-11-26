import { createServer, type Server } from 'node:net';

/** Holds a loopback port open until `release` is called. */
export async function occupyLoopbackPort(
    port = 0,
): Promise<{ port: number; release(): Promise<void> }> {
    const server: Server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    return {
        port: typeof address === 'object' && address ? address.port : port,
        release: () => new Promise((resolve) => server.close(() => resolve())),
    };
}

/** A port that was free a moment ago. */
export async function freeLoopbackPort(): Promise<number> {
    const held = await occupyLoopbackPort();
    await held.release();
    return held.port;
}
