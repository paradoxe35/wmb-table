import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let cacheDir = '';

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@main/lib/app-paths', () => ({ getAudioCacheDir: () => cacheDir }));

const setDownload = vi.fn();
const getDownloadByAudioLink = vi.fn(() => null as { local_file?: string } | null);
vi.mock('@main/database/repositories/audio.repository', () => ({
    setDownload: (...args: unknown[]) => setDownload(...args),
    getDownloadByAudioLink: () => getDownloadByAudioLink(),
}));

const { cacheAudio } = await import('@main/services/audio-cache.service');

const AUDIO_URL = 'https://example.invalid/sermons/63-0101.mp3';
const CACHED_NAME = `${createHash('sha256').update(AUDIO_URL).digest('hex')}.mp3`;

const fetchMock = vi.fn();

function cachedPath(suffix = ''): string {
    return join(cacheDir, `${CACHED_NAME}${suffix}`);
}

function bodyOf(text: string): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
        },
    });
}

function response(status: number, text: string, headers: Record<string, string> = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        body: status === 416 ? null : bodyOf(text),
        headers: new Headers({ 'content-length': String(text.length), ...headers }),
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => text,
    } as unknown as Response;
}

function rangeHeaderOf(callIndex: number): string | undefined {
    return fetchMock.mock.calls[callIndex]?.[1]?.headers?.Range;
}

/**
 * Only setTimeout is faked, so the service's start delay and backoff are skipped while the
 * file-system streams it awaits still run on the real event loop.
 */
async function drainUntil<T>(work: Promise<T>): Promise<T> {
    let settled = false;
    const pending = work.finally(() => {
        settled = true;
    });

    // Yield for the real file-system work, then jump straight to the next pending timer
    // rather than stepping blindly, which is far too slow when the suite runs in parallel.
    for (let turn = 0; turn < 5_000 && !settled; turn++) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!settled && vi.getTimerCount() > 0) {
            await vi.advanceTimersToNextTimerAsync();
        }
    }

    const result = await pending;
    expect(settled).toBe(true);
    return result;
}

function runCacheAudio(): Promise<void> {
    return drainUntil(cacheAudio(AUDIO_URL));
}

beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'wmb-audio-cache-'));
    fetchMock.mockReset();
    setDownload.mockReset();
    getDownloadByAudioLink.mockReturnValue(null);
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    rmSync(cacheDir, { recursive: true, force: true });
});

describe('cacheAudio', { timeout: 20_000 }, () => {
    it('downloads, promotes the partial file and records it', async () => {
        fetchMock.mockImplementation(async () => response(200, 'SERMON-AUDIO'));

        await runCacheAudio();

        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
        expect(existsSync(cachedPath('.part'))).toBe(false);
        expect(setDownload).toHaveBeenCalledWith(AUDIO_URL, cachedPath());
        expect(rangeHeaderOf(0)).toBeUndefined();
    });

    it('does nothing when the file is already cached', async () => {
        getDownloadByAudioLink.mockReturnValue({ local_file: cachedPath() });

        await runCacheAudio();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks only for the missing bytes when a partial file survived', async () => {
        writeFileSync(cachedPath('.part'), 'SERMON-');
        fetchMock.mockImplementation(async () =>
            response(206, 'AUDIO', { 'content-range': 'bytes 7-11/12' }),
        );

        await runCacheAudio();

        expect(rangeHeaderOf(0)).toBe('bytes=7-');
        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
    });

    it('starts over when the server ignores the range request', async () => {
        writeFileSync(cachedPath('.part'), 'STALE-');
        fetchMock.mockImplementation(async () => response(200, 'SERMON-AUDIO'));

        await runCacheAudio();

        expect(rangeHeaderOf(0)).toBe('bytes=6-');
        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
    });

    it('discards a partial the server no longer recognises and refetches it whole', async () => {
        writeFileSync(cachedPath('.part'), 'WAY-TOO-LONG-ALREADY');
        fetchMock
            .mockImplementationOnce(async () => response(416, ''))
            .mockImplementation(async () => response(200, 'SERMON-AUDIO'));

        await runCacheAudio();

        expect(rangeHeaderOf(0)).toBe('bytes=20-');
        expect(rangeHeaderOf(1)).toBeUndefined();
        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
    });

    it('retries a dropped connection and resumes from what it already had', async () => {
        fetchMock
            .mockImplementationOnce(async () => response(200, 'SERM', { 'content-length': '12' }))
            .mockImplementationOnce(async () => {
                throw Object.assign(new TypeError('fetch failed'), {
                    cause: Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }),
                });
            })
            .mockImplementation(async () => response(206, 'ON-AUDIO'));

        await runCacheAudio();

        expect(rangeHeaderOf(1)).toBe('bytes=4-');
        expect(rangeHeaderOf(2)).toBe('bytes=4-');
        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
        expect(setDownload).toHaveBeenCalledOnce();
    });

    it('does not accept a body that stopped short of the announced length', async () => {
        fetchMock.mockImplementation(async () => response(200, 'SERM', { 'content-length': '12' }));

        await runCacheAudio();

        expect(existsSync(cachedPath())).toBe(false);
        expect(setDownload).not.toHaveBeenCalled();
    });

    it('keeps the partial file for next time when every attempt fails', async () => {
        fetchMock.mockImplementation(async () => {
            throw Object.assign(new TypeError('fetch failed'), {
                cause: Object.assign(new Error('ENETUNREACH'), { code: 'ENETUNREACH' }),
            });
        });
        writeFileSync(cachedPath('.part'), 'SERMON-');

        await runCacheAudio();

        expect(existsSync(cachedPath())).toBe(false);
        expect(readFileSync(cachedPath('.part'), 'utf-8')).toBe('SERMON-');
        expect(setDownload).not.toHaveBeenCalled();
    });

    it('stops retrying an error that retrying cannot fix', async () => {
        fetchMock.mockImplementation(async () => response(404, 'gone'));

        await runCacheAudio();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(setDownload).not.toHaveBeenCalled();
    });

    it('never runs two downloads for the same link at once', async () => {
        fetchMock.mockImplementation(async () => response(200, 'SERMON-AUDIO'));

        const first = cacheAudio(AUDIO_URL);
        const second = cacheAudio(AUDIO_URL);
        await drainUntil(Promise.all([first, second]));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(readFileSync(cachedPath(), 'utf-8')).toBe('SERMON-AUDIO');
    });
});
