import { Worker } from 'node:worker_threads';
import log from 'electron-log';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
export interface WorkerProgressEvent {
    percentage: number;
    phase?: string;
}

/**
 * Lightweight RPC wrapper over a Node.js Worker thread.
 *
 * Protocol (same as the existing worker message format):
 *   Request:  { id: number, method: string, args: unknown[] }
 *   Response: { id: number, result?: unknown, error?: string }
 *   Progress: { id: -1, result: { type: 'progress', percentage: number, phase?: string } }
 */
export class WorkerRpc {
    private worker: Worker | null = null;
    private nextId = 0;
    private pending = new Map<number, Pending>();

    /** Set before calling a long-running method to receive progress events. */
    onProgressEvent: ((event: WorkerProgressEvent) => void) | null = null;

    constructor(
        private readonly workerPath: string,
        private readonly tag: string,
    ) {}

    private getWorker(): Worker {
        if (!this.worker) {
            this.worker = new Worker(this.workerPath);
            this.worker.on('message', (msg: { id: number; result?: unknown; error?: string }) => {
                if (msg.id === -1 && msg.result && typeof msg.result === 'object') {
                    const r = msg.result as WorkerProgressEvent & { type?: string };
                    if (r.type === 'progress') {
                        this.onProgressEvent?.({
                            percentage: r.percentage ?? 0,
                            phase: r.phase,
                        });
                    }
                    return;
                }
                const p = this.pending.get(msg.id);
                if (!p) return;
                this.pending.delete(msg.id);
                if (msg.error) p.reject(new Error(msg.error));
                else p.resolve(msg.result);
            });
            this.worker.on('error', (err) => log.error(`[${this.tag}] Worker error:`, err));
        }
        return this.worker;
    }

    call<T>(method: string, ...args: unknown[]): Promise<T> {
        const id = ++this.nextId;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
            this.getWorker().postMessage({ id, method, args });
        });
    }

    dispose(): void {
        this.worker?.terminate().catch(() => {});
        this.worker = null;
        this.pending.clear();
    }
}
