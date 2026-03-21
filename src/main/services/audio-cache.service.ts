import { createWriteStream, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import log from 'electron-log';
import { getAudioCacheDir } from '@main/lib/app-paths';
import * as audioRepo from '@main/database/repositories/audio.repository';

const inProgress = new Set<string>();

/** Delay before starting download so the streaming player can buffer first. */
const INITIAL_DELAY_MS = 5_000;

/** Pause between chunk reads to throttle bandwidth (~1 MB/s effective). */
const CHUNK_DELAY_MS = 50;

function deriveFileName(audioLink: string): string {
    const hash = createHash('sha256').update(audioLink).digest('hex').slice(0, 16);
    try {
        const ext = new URL(audioLink).pathname.split('.').pop() || 'mp3';
        return `${hash}.${ext}`;
    } catch {
        return `${hash}.mp3`;
    }
}

/**
 * Download an audio file in the background and save it to the cache directory.
 * Fire-and-forget — errors are logged but never thrown to callers.
 */
export async function cacheAudio(audioLink: string): Promise<void> {
    if (inProgress.has(audioLink)) return;

    const existing = audioRepo.getDownloadByAudioLink(audioLink);
    if (existing?.local_file && existsSync(existing.local_file)) return;

    inProgress.add(audioLink);
    const fileName = deriveFileName(audioLink);
    const filePath = join(getAudioCacheDir(), fileName);

    // Clean up orphaned partial file (no DB record = never fully downloaded)
    if (!existing?.local_file && existsSync(filePath)) {
        try {
            unlinkSync(filePath);
        } catch {
            /* ignore */
        }
    }

    try {
        // Let the streaming player buffer first
        await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS));

        const response = await fetch(audioLink);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const body = response.body;
        if (!body) throw new Error('No response body');

        const fileStream = createWriteStream(filePath);
        const reader = (body as ReadableStream<Uint8Array>).getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const canContinue = fileStream.write(value);
                // Respect backpressure — wait for drain before reading more
                if (!canContinue) {
                    await new Promise<void>((r) => fileStream.once('drain', r));
                }
                // Throttle to avoid competing with the streaming player
                await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
            }
        } finally {
            fileStream.end();
        }

        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        audioRepo.setDownload(audioLink, filePath);
        log.info(`Audio cached: ${fileName}`);
    } catch (err) {
        log.warn(`Audio cache failed for ${audioLink}:`, err);
        try {
            if (existsSync(filePath)) unlinkSync(filePath);
        } catch {
            /* ignore cleanup errors */
        }
    } finally {
        inProgress.delete(audioLink);
    }
}
