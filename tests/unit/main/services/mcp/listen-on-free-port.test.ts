import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { listenOnFreePort, NoFreePortError } from '@main/services/mcp/listen-on-free-port';
import { freeLoopbackPort, occupyLoopbackPort } from '../../../../helpers/free-port';

const HOST = '127.0.0.1';
const held: { release(): Promise<void> }[] = [];
let server: Server | null = null;

async function occupy(port: number): Promise<void> {
    held.push(await occupyLoopbackPort(port));
}

/** A run of `count` consecutive ports that are free right now. */
async function freeRun(count: number): Promise<number> {
    for (;;) {
        const first = await freeLoopbackPort();
        const probes = await Promise.allSettled(
            Array.from({ length: count }, (_, i) => occupyLoopbackPort(first + i)),
        );
        await Promise.all(
            probes.map((probe) => (probe.status === 'fulfilled' ? probe.value.release() : null)),
        );
        if (probes.every((probe) => probe.status === 'fulfilled')) return first;
    }
}

afterEach(async () => {
    await Promise.all(held.splice(0).map((port) => port.release()));
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = null;
});

describe('listenOnFreePort', () => {
    it('uses the first port when it is free', async () => {
        const first = await freeRun(3);
        server = createServer();
        expect(await listenOnFreePort(server, HOST, first, 3)).toBe(first);
        expect(server.listening).toBe(true);
    });

    it('moves to the next port when the first one is taken', async () => {
        const first = await freeRun(3);
        await occupy(first);
        server = createServer();
        expect(await listenOnFreePort(server, HOST, first, 3)).toBe(first + 1);
    });

    it('skips several taken ports', async () => {
        const first = await freeRun(4);
        await occupy(first);
        await occupy(first + 1);
        await occupy(first + 2);
        server = createServer();
        expect(await listenOnFreePort(server, HOST, first, 4)).toBe(first + 3);
    });

    it('fails with the range it tried when every port is taken', async () => {
        const first = await freeRun(2);
        await occupy(first);
        await occupy(first + 1);
        server = createServer();
        const attempt = listenOnFreePort(server, HOST, first, 2);
        await expect(attempt).rejects.toBeInstanceOf(NoFreePortError);
        await expect(attempt).rejects.toMatchObject({ firstPort: first, lastPort: first + 1 });
        expect(server.listening).toBe(false);
    });

    it('does not go past the last valid port', async () => {
        await occupy(65_534).catch(() => undefined);
        await occupy(65_535).catch(() => undefined);
        server = createServer();
        await expect(listenOnFreePort(server, HOST, 65_534, 5)).rejects.toMatchObject({
            firstPort: 65_534,
            lastPort: 65_535,
        });
    });

    it('passes on errors that are not about a taken port', async () => {
        server = createServer();
        await expect(listenOnFreePort(server, '203.0.113.1', 40_000, 3)).rejects.toMatchObject({
            code: 'EADDRNOTAVAIL',
        });
    });
});
