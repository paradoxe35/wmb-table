import type { Server } from 'node:net';

const MAX_PORT = 65_535;

export class NoFreePortError extends Error {
    readonly firstPort: number;
    readonly lastPort: number;

    constructor(firstPort: number, lastPort: number) {
        super(`No free port between ${firstPort} and ${lastPort}.`);
        this.name = 'NoFreePortError';
        this.firstPort = firstPort;
        this.lastPort = lastPort;
    }
}

/** Windows answers EACCES for ports it reserves (Hyper-V), so that counts as taken too. */
function isPortTaken(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return code === 'EADDRINUSE' || code === 'EACCES';
}

function listen(server: Server, port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
    });
}

/** Tries `firstPort`, then the next ones, and resolves with the port actually used. */
export async function listenOnFreePort(
    server: Server,
    host: string,
    firstPort: number,
    attempts: number,
): Promise<number> {
    const lastPort = Math.min(firstPort + attempts - 1, MAX_PORT);
    for (let port = firstPort; port <= lastPort; port++) {
        try {
            await listen(server, port, host);
            return port;
        } catch (error) {
            if (!isPortTaken(error)) throw error;
        }
    }
    throw new NoFreePortError(firstPort, lastPort);
}
