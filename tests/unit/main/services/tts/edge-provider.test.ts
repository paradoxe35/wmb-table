import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRetryableError } from '@main/lib/network-retry';

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@main/lib/simple-cache', () => ({
    SimpleCache: class {
        getOrFetch<T>(fetch: () => Promise<T>) {
            return fetch();
        }
    },
}));

/** One answer per connection, in order; a string is the error Edge's connection fails with. */
let answers: (string | null)[] = [];
let connections = 0;
let inFlight = 0;
let mostInFlight = 0;
/** Lets a test hold connections open to see how many run at once. */
let hold: Promise<void> | null = null;

vi.mock('node-edge-tts', () => ({
    EdgeTTS: class {
        async ttsPromise(_text: string, path: string) {
            connections++;
            inFlight++;
            mostInFlight = Math.max(mostInFlight, inFlight);
            try {
                if (hold) await hold;
                const answer = answers.shift() ?? null;
                if (answer) throw new Error(answer);
                await writeFile(path, Buffer.from([1, 2, 3]));
            } finally {
                inFlight--;
            }
        }
    },
}));

const { EdgeProvider, EDGE_BUSY_MESSAGE } = await import('@main/services/tts/edge.provider');

const synthesize = () =>
    new EdgeProvider().synthesize({ text: 'Au commencement était la Parole.', language: 'fr' });

/** Runs a synthesis through its retry waits. */
async function settle<T>(work: Promise<T>): Promise<T> {
    const result = work.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
    );
    await vi.advanceTimersByTimeAsync(120_000);
    const outcome = await result;
    if ('error' in outcome) throw outcome.error;
    return outcome.value;
}

beforeEach(() => {
    answers = [];
    connections = 0;
    inFlight = 0;
    mostInFlight = 0;
    hold = null;
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('EdgeProvider when Edge refuses', () => {
    it('tries again after a 429 and reads on', async () => {
        answers = ['Unexpected server response: 429'];
        const result = await settle(synthesize());
        expect(result.audioBase64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
        expect(connections).toBe(2);
    });

    it('tries again after a 409', async () => {
        answers = ['Unexpected server response: 409', 'Unexpected server response: 409'];
        await settle(synthesize());
        expect(connections).toBe(3);
    });

    it('tries again after a server error or a dropped connection', async () => {
        answers = [
            'Unexpected server response: 503',
            'Timed out while connecting to Edge TTS',
            'WebSocket closed before turn.end (code 1006)',
        ];
        await settle(synthesize());
        expect(connections).toBe(4);
    });

    it('waits longer each time before trying again', async () => {
        answers = Array(3).fill('Unexpected server response: 429');
        const times: number[] = [];
        const work = synthesize();
        const started = Date.now();
        for (let ms = 0; ms < 60_000 && connections < 4; ms += 100) {
            const before = connections;
            await vi.advanceTimersByTimeAsync(100);
            if (connections > before) times.push(Date.now() - started);
        }
        await settle(work);
        const gaps = times.slice(1).map((time, i) => time - times[i]);
        expect(gaps).toHaveLength(3);
        expect(gaps[0]).toBeGreaterThanOrEqual(1_000);
        expect(gaps[2]).toBeGreaterThan(gaps[0]);
    });

    it('says Edge is busy when it keeps refusing, and stays worth retrying later', async () => {
        answers = Array(10).fill('Unexpected server response: 429');
        const error = await settle(synthesize()).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(EDGE_BUSY_MESSAGE);
        expect(isRetryableError(error)).toBe(true);
        expect(connections).toBe(4);
    });

    it('does not insist on a refusal that waiting cannot fix', async () => {
        answers = ['Unexpected server response: 403'];
        const error = await settle(synthesize()).catch((e: unknown) => e);
        expect((error as Error).message).toBe('Unexpected server response: 403');
        expect(connections).toBe(1);
    });

    it('keeps at most two requests to Edge at once', async () => {
        let release = () => {};
        hold = new Promise((resolve) => (release = resolve));
        const work = Promise.all(Array.from({ length: 5 }, synthesize));
        await vi.advanceTimersByTimeAsync(0);
        expect(inFlight).toBe(2);
        release();
        await settle(work);
        expect(connections).toBe(5);
        expect(mostInFlight).toBe(2);
    });

    it('lets other sentences through while one waits to try again', async () => {
        answers = ['Unexpected server response: 429'];
        const first = synthesize();
        await vi.advanceTimersByTimeAsync(0);
        const others = Promise.all([synthesize(), synthesize()]);
        await vi.advanceTimersByTimeAsync(500);
        expect(connections).toBe(3);
        await settle(Promise.all([first, others]));
        expect(connections).toBe(4);
    });
});
