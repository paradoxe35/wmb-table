import { createWriteStream, existsSync } from 'node:fs';
import { rename, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import log from 'electron-log';
import { getAudioCacheDir } from '@main/lib/app-paths';
import { HttpStatusError, RetryableError, retryNetworkCall } from '@main/lib/network-retry';
import * as audioRepo from '@main/database/repositories/audio.repository';

const inProgress = new Set<string>();

const RETRIES = 3;

const TIMINGS = {
    /** Delay before starting download so the streaming player can buffer first. */
    initialDelayMs: 5_000,
    /** Pause between chunk reads to throttle bandwidth (~1 MB/s effective). */
    chunkDelayMs: 50,
    retryMinDelayMs: 2_000,
};

export const __testing = { TIMINGS };

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveFileName(audioLink: string): string {
    const hash = createHash('sha256').update(audioLink).digest('hex');
    try {
        const pathname = new URL(audioLink).pathname;
        const lastSegment = pathname.split('/').pop() || '';
        const dotIndex = lastSegment.lastIndexOf('.');
        const ext = dotIndex > 0 ? lastSegment.slice(dotIndex + 1) : 'mp3';
        return `${hash}.${ext}`;
    } catch {
        return `${hash}.mp3`;
    }
}

async function fileSize(path: string): Promise<number> {
    const info = await stat(path).catch(() => null);
    return info?.size ?? 0;
}

async function requestFrom(audioLink: string, offset: number): Promise<Response> {
    const response = await fetch(
        audioLink,
        offset > 0 ? { headers: { Range: `bytes=${offset}-` } } : {},
    );

    if (!response.ok) {
        await response.arrayBuffer().catch(() => undefined);
        throw new HttpStatusError(response.status, `Audio download failed: ${response.status}`);
    }
    return response;
}

async function streamToFile(
    body: ReadableStream<Uint8Array>,
    filePath: string,
    append: boolean,
): Promise<void> {
    const fileStream = createWriteStream(filePath, { flags: append ? 'a' : 'w' });
    const reader = body.getReader();

    // Attach listeners immediately to prevent unhandled 'error' crashes.
    // .catch(noop) prevents unhandled rejection if streamDone rejects before
    // it is awaited (e.g. reader.read() throws at the same time as a disk error).
    const streamDone = new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
    });
    streamDone.catch(() => {});

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (fileStream.errored) break;

            const canContinue = fileStream.write(value);
            // Respect backpressure — wait for drain before reading more.
            // Race with error to avoid hanging if the stream breaks.
            if (!canContinue && !fileStream.errored) {
                await new Promise<void>((resolve) => {
                    fileStream.once('drain', resolve);
                    fileStream.once('error', () => resolve());
                });
            }
            // Throttle to avoid competing with the streaming player
            await delay(TIMINGS.chunkDelayMs);
        }
    } finally {
        reader.cancel().catch(() => {});
        fileStream.end();
    }

    await streamDone;
}

/**
 * Appends to `partPath` from wherever the last attempt stopped, so an interrupted download
 * costs only the bytes still missing. A server that ignores the Range header restarts it.
 */
async function downloadPart(audioLink: string, partPath: string): Promise<void> {
    const offset = await fileSize(partPath);

    let response: Response;
    try {
        response = await requestFrom(audioLink, offset);
    } catch (error) {
        if (error instanceof HttpStatusError && error.status === 416) {
            await unlink(partPath).catch(() => {});
            throw new RetryableError('Partial audio no longer matches the remote file');
        }
        throw error;
    }

    if (!response.body) throw new RetryableError('Audio download returned no body');

    const resumed = response.status === 206 && offset > 0;
    await streamToFile(response.body as ReadableStream<Uint8Array>, partPath, resumed);

    const expectedBytes = Number(response.headers.get('content-length'));
    if (!Number.isFinite(expectedBytes) || expectedBytes <= 0) return;

    const total = (resumed ? offset : 0) + expectedBytes;
    if ((await fileSize(partPath)) !== total) {
        throw new RetryableError('Audio download ended before the whole file arrived');
    }
}

/**
 * Download an audio file in the background and save it to the cache directory.
 * Fire-and-forget — errors are logged but never thrown to callers. A failed attempt keeps
 * its partial file so the next play resumes rather than starting over.
 */
export async function cacheAudio(audioLink: string): Promise<void> {
    if (inProgress.has(audioLink)) return;

    const existing = audioRepo.getDownloadByAudioLink(audioLink);
    if (existing?.local_file) return; // repo already verified file exists on disk

    inProgress.add(audioLink);
    const fileName = deriveFileName(audioLink);
    const filePath = join(getAudioCacheDir(), fileName);
    const partPath = `${filePath}.part`;

    // No DB record means this file was never completed; it also blocks rename on Windows.
    if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
    }

    try {
        // Let the streaming player buffer first
        await delay(TIMINGS.initialDelayMs);

        await retryNetworkCall(() => downloadPart(audioLink, partPath), {
            label: `Audio cache ${fileName}`,
            retries: RETRIES,
            minTimeoutMs: TIMINGS.retryMinDelayMs,
        });

        await rename(partPath, filePath);
        audioRepo.setDownload(audioLink, filePath);
        log.info(`Audio cached: ${basename(filePath)}`);
    } catch (err) {
        log.warn(`Audio cache failed for ${audioLink}:`, err);
    } finally {
        inProgress.delete(audioLink);
    }
}
