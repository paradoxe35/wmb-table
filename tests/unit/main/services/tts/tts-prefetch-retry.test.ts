import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TtsSegment } from '@shared/tts.types';

const sendToRenderer = vi.fn();
const mainWindow = {} as Electron.BrowserWindow;

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@main/lib/window', () => ({ getMainWindow: () => mainWindow }));
vi.mock('@main/ipc/register', () => ({
    sendToRenderer: (...args: unknown[]) => sendToRenderer(...args),
}));
vi.mock('@main/lib/app-paths', () => ({
    getTtsCacheDir: () => '/tmp/tts-cache',
    getTtsResourceDir: () => '/tmp/tts-resources',
}));
vi.mock('@main/database/repositories/tts.repository', () => ({
    ensureSettings: () => ({
        activeProvider: 'sherpa',
        cacheMaxSizeMb: 100,
        autoSwitchVoice: false,
        providers: {},
    }),
}));

class ProviderStub {
    setConfig() {}
    async getInfo() {
        return {};
    }
}
for (const module of [
    '@main/services/tts/sherpa.provider',
    '@main/services/tts/openai.provider',
    '@main/services/tts/elevenlabs.provider',
    '@main/services/tts/edge.provider',
    '@main/services/tts/cartesia.provider',
]) {
    vi.doMock(module, () => ({
        SherpaProvider: ProviderStub,
        OpenAiProvider: ProviderStub,
        ElevenLabsProvider: ProviderStub,
        EdgeProvider: ProviderStub,
        CartesiaProvider: ProviderStub,
    }));
}

const { TtsService } = await import('@main/services/tts/tts.service');

const CACHE_HIT = { path: '/tmp/tts-cache/segment.wav', mimeType: 'audio/wav' };

/** What Undici actually throws when the connection disappears mid-request. */
function networkError(): TypeError {
    return Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }),
    });
}

function segments(count: number): TtsSegment[] {
    return Array.from({ length: count }, (_, i) => ({ text: `segment ${i}` }) as TtsSegment);
}

/** Reaches past the class API: prefetch is internal, and it is exactly what regressed. */
interface Internals {
    segments: TtsSegment[];
    prepared: Set<number>;
    playbackGeneration: number;
    status: string;
    prepareSegment: (segment: TtsSegment) => Promise<unknown>;
    prepareAndQueue: (index: number, generation: number) => Promise<void>;
}

function createService(segmentCount = 3) {
    const service = new TtsService();
    const internals = service as unknown as Internals;
    internals.segments = segments(segmentCount);
    internals.playbackGeneration = 1;
    internals.status = 'playing';
    return { service, internals };
}

function audioPushes() {
    return sendToRenderer.mock.calls.filter((call) => call[1] === 'push:ttsSegmentAudio');
}

function lastState() {
    const stateCalls = sendToRenderer.mock.calls.filter(
        (call) => call[1] === 'push:ttsPlaybackState',
    );
    return stateCalls.at(-1)?.[2] as { status: string; error?: string } | undefined;
}

beforeEach(() => {
    sendToRenderer.mockClear();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('prefetch recovery after a network outage', () => {
    it('keeps retrying and delivers the segment once the network returns', async () => {
        const { internals } = createService();
        let attempts = 0;
        internals.prepareSegment = vi.fn(async () => {
            attempts++;
            if (attempts < 4) throw networkError();
            return CACHE_HIT;
        });
        internals.prepared.add(1);

        const pending = internals.prepareAndQueue(1, 1);
        await vi.advanceTimersByTimeAsync(60_000);
        await pending;

        expect(attempts).toBe(4);
        expect(audioPushes()).toHaveLength(1);
        expect(audioPushes()[0][2]).toMatchObject({ segmentIndex: 1, queued: true });
        expect(lastState()).toBeUndefined();
    });

    it('backs off exponentially and never exceeds the cap', async () => {
        const { internals } = createService();
        const attemptTimes: number[] = [];
        internals.prepareSegment = vi.fn(async () => {
            attemptTimes.push(Date.now());
            throw networkError();
        });
        internals.prepared.add(1);

        const pending = internals.prepareAndQueue(1, 1);
        await vi.advanceTimersByTimeAsync(60_000);

        const gaps = attemptTimes.slice(1).map((time, i) => time - attemptTimes[i]);
        expect(gaps.length).toBeGreaterThan(4);
        // Jittered, so each gap sits between the nominal delay and twice it, capped at 15s.
        expect(gaps[0]).toBeGreaterThanOrEqual(1_000);
        expect(gaps[1]).toBeGreaterThan(gaps[0]);
        expect(gaps.every((gap) => gap <= 15_000)).toBe(true);
        // Backoff means far fewer attempts than a tight loop would make.
        expect(attemptTimes.length).toBeLessThan(15);

        internals.playbackGeneration = 2;
        await vi.advanceTimersByTimeAsync(20_000);
        await pending;
    });

    it('fails fast on an error that retrying cannot fix', async () => {
        const { internals } = createService();
        const prepareSegment = vi.fn(async () => {
            throw new Error('Le modele de voix est introuvable');
        });
        internals.prepareSegment = prepareSegment;
        internals.prepared.add(1);

        await internals.prepareAndQueue(1, 1);

        expect(prepareSegment).toHaveBeenCalledTimes(1);
        expect(internals.prepared.has(1)).toBe(false);
        expect(lastState()).toMatchObject({ status: 'error' });
    });

    it('releases the slot and reports the failure once the budget runs out', async () => {
        const { internals } = createService();
        internals.prepareSegment = vi.fn(async () => {
            throw networkError();
        });
        internals.prepared.add(1);

        const pending = internals.prepareAndQueue(1, 1);
        await vi.advanceTimersByTimeAsync(200_000);
        await pending;

        expect(internals.prepared.has(1)).toBe(false);
        expect(lastState()).toMatchObject({ status: 'error', error: 'fetch failed' });
        expect(audioPushes()).toHaveLength(0);
    });

    it('gives up quietly when playback moved on mid-outage', async () => {
        const { internals } = createService();
        internals.prepareSegment = vi.fn(async () => {
            throw networkError();
        });
        internals.prepared.add(1);

        const pending = internals.prepareAndQueue(1, 1);
        await vi.advanceTimersByTimeAsync(5_000);
        internals.playbackGeneration = 2;
        await vi.advanceTimersByTimeAsync(200_000);
        await pending;

        expect(lastState()).toBeUndefined();
        expect(audioPushes()).toHaveLength(0);
    });

    it('drops a segment that arrives after playback moved on', async () => {
        const { internals } = createService();
        internals.prepareSegment = vi.fn(async () => {
            internals.playbackGeneration = 2;
            return CACHE_HIT;
        });
        internals.prepared.add(1);

        await internals.prepareAndQueue(1, 1);

        expect(audioPushes()).toHaveLength(0);
    });
});
