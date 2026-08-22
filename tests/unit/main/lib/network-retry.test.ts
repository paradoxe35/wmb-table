import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
    HttpStatusError,
    RetryableError,
    fetchWithRetry,
    isRetryableError,
    isRetryableStatus,
    retryNetworkCall,
} from '@main/lib/network-retry';

/** What Undici actually throws when the connection disappears mid-request. */
function undiciNetworkError(code = 'ECONNRESET'): TypeError {
    return Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error(code), { code }),
    });
}

function jsonResponse(status: number, body = '') {
    return new Response(body, { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('isRetryableError', () => {
    it('retries what the app knows is transient', () => {
        expect(isRetryableError(new RetryableError('truncated'))).toBe(true);
    });

    it('follows the HTTP status carried on the error', () => {
        expect(isRetryableError(new HttpStatusError(503, 'down'))).toBe(true);
        expect(isRetryableError(new HttpStatusError(429, 'slow down'))).toBe(true);
        expect(isRetryableError(new HttpStatusError(404, 'gone'))).toBe(false);
        expect(isRetryableError(new HttpStatusError(401, 'bad key'))).toBe(false);
    });

    it('recognises the shapes a dropped connection really produces', () => {
        expect(isRetryableError(undiciNetworkError())).toBe(true);
        expect(isRetryableError(new TypeError('terminated'))).toBe(true);
        expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    });

    it('digs the syscall code out of the cause chain', () => {
        const wrapped = Object.assign(new Error('request failed'), {
            cause: Object.assign(new Error('inner'), { code: 'ETIMEDOUT' }),
        });

        expect(isRetryableError(wrapped)).toBe(true);
    });

    it('retries a timeout but not a deliberate abort', () => {
        expect(isRetryableError(new DOMException('timed out', 'TimeoutError'))).toBe(true);
        expect(isRetryableError(new DOMException('cancelled', 'AbortError'))).toBe(false);
    });

    it('leaves errors that retrying cannot fix alone', () => {
        expect(isRetryableError(new Error('voice model missing'))).toBe(false);
        expect(isRetryableError(new TypeError('x.map is not a function'))).toBe(false);
        expect(isRetryableError(null)).toBe(false);
        expect(isRetryableError(undefined)).toBe(false);
    });

    it('agrees with isRetryableStatus', () => {
        expect(isRetryableStatus(500)).toBe(true);
        expect(isRetryableStatus(408)).toBe(true);
        expect(isRetryableStatus(400)).toBe(false);
    });
});

describe('retryNetworkCall', () => {
    it('returns the first success without waiting', async () => {
        const fn = vi.fn(async () => 'done');

        await expect(retryNetworkCall(fn, { label: 'test' })).resolves.toBe('done');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries a transient failure and then succeeds', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            if (++calls < 3) throw undiciNetworkError();
            return 'done';
        });

        const pending = retryNetworkCall(fn, { label: 'test', minTimeoutMs: 10 });
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(pending).resolves.toBe('done');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('gives up immediately on a permanent failure', async () => {
        const fn = vi.fn(async () => {
            throw new Error('bad api key');
        });

        await expect(retryNetworkCall(fn, { label: 'test' })).rejects.toThrow('bad api key');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('honours the retry budget', async () => {
        const fn = vi.fn(async () => {
            throw undiciNetworkError();
        });

        const settled = expect(
            retryNetworkCall(fn, {
                label: 'test',
                retries: 2,
                minTimeoutMs: 10,
            }),
        ).rejects.toThrow('fetch failed');
        await vi.advanceTimersByTimeAsync(5_000);

        await settled;
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('stops as soon as the work becomes obsolete', async () => {
        let live = true;
        const fn = vi.fn(async () => {
            throw undiciNetworkError();
        });

        const settled = expect(
            retryNetworkCall(fn, {
                label: 'test',
                retries: Number.POSITIVE_INFINITY,
                minTimeoutMs: 10,
                shouldContinue: () => live,
            }),
        ).rejects.toThrow('fetch failed');
        await vi.advanceTimersByTimeAsync(200);
        live = false;
        await vi.advanceTimersByTimeAsync(5_000);
        await settled;

        const callsAtStop = fn.mock.calls.length;
        await vi.advanceTimersByTimeAsync(30_000);
        expect(fn).toHaveBeenCalledTimes(callsAtStop);
    });
});

describe('fetchWithRetry', () => {
    it('passes a successful response straight through', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(200, 'ok'));

        const response = await fetchWithRetry('https://example.invalid', {}, { label: 'test' });

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a 503 and returns the eventual success', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(503))
            .mockResolvedValueOnce(jsonResponse(200, 'ok'));

        const pending = fetchWithRetry(
            'https://example.invalid',
            {},
            { label: 'test', minTimeoutMs: 10 },
        );
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(pending.then((r) => r.status)).resolves.toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a client error', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(401, 'bad key'));

        const response = await fetchWithRetry('https://example.invalid', {}, { label: 'test' });

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('hands back the last failing response with its body still readable', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(500, '{"error":"boom"}'));

        const pending = fetchWithRetry(
            'https://example.invalid',
            {},
            { label: 'test', retries: 1, minTimeoutMs: 10 },
        );
        await vi.advanceTimersByTimeAsync(5_000);
        const response = await pending;

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toBe('{"error":"boom"}');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('leaves a create request alone on a server error but still retries transport failures', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(500));
        const noStatusRetry = await fetchWithRetry(
            'https://example.invalid',
            { method: 'POST' },
            { label: 'clone', retryOnStatus: false },
        );
        expect(noStatusRetry.status).toBe(500);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fetchMock.mockReset();
        fetchMock
            .mockRejectedValueOnce(undiciNetworkError())
            .mockResolvedValueOnce(jsonResponse(200, 'ok'));

        const pending = fetchWithRetry(
            'https://example.invalid',
            { method: 'POST' },
            { label: 'clone', retryOnStatus: false, minTimeoutMs: 10 },
        );
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(pending.then((r) => r.status)).resolves.toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
