export type WaitFn = (delayMs: number) => Promise<void>;

const defaultWait: WaitFn = (delayMs) => window.api.timer.wait(delayMs);

/** Above this a sample is a stall, not round-trip cost. */
const MAX_LEARNED_OVERHEAD_MS = 100;

/**
 * Waits in the main process, whose timers are not throttled when the renderer is hidden.
 * Each wait is shortened by the smallest round trip seen so far; the minimum tracks the floor,
 * where a noisy sample would over-correct and cut the gap short.
 */
export class UnthrottledTimer {
    private token = 0;
    private armed = false;
    private overheadMs: number | null = null;

    constructor(private readonly wait: WaitFn = defaultWait) {}

    get pending(): boolean {
        return this.armed;
    }

    schedule(delayMs: number, run: () => void): void {
        const scheduled = ++this.token;
        this.armed = true;

        const requestedMs = Math.max(0, delayMs - (this.overheadMs ?? 0));
        const startedAt = Date.now();
        const settle = () => this.settle(scheduled, run, requestedMs, startedAt);

        // Settle on failure too: a stall is worse than a short gap.
        this.wait(requestedMs).then(settle, settle);
    }

    cancel(): void {
        this.token++;
        this.armed = false;
    }

    private settle(
        scheduled: number,
        run: () => void,
        requestedMs: number,
        startedAt: number,
    ): void {
        this.learnOverhead(Date.now() - startedAt - requestedMs);
        if (scheduled !== this.token) return;
        this.armed = false;
        run();
    }

    private learnOverhead(sampleMs: number): void {
        if (sampleMs < 0 || sampleMs > MAX_LEARNED_OVERHEAD_MS) return;
        this.overheadMs = this.overheadMs === null ? sampleMs : Math.min(this.overheadMs, sampleMs);
    }
}
