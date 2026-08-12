import { readFile, writeFile, unlink, rm, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { getTtsCacheDir } from '@main/lib/app-paths';
import * as ttsCacheRepo from '@main/database/repositories/tts-cache.repository';
import { DEFAULT_CACHE_MAX_SIZE_MB, TTS_PROVIDER_TYPES } from '@shared/tts.types';
import type { TtsCacheKey, TtsSynthesizeResult } from '@shared/tts.types';

const EVICTION_BATCH_SIZE = 200;

/** Reference to a cached file on disk — audio is read only when needed. */
export interface CacheHit {
    path: string;
    mimeType: string;
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * A voice id carries its speaker after a colon (`…-tom-medium-int8:0`), which Windows reads as
 * a drive separator and refuses to `mkdir`. Every segment is folded: any provider's voice name
 * can hold one of these.
 */
export function pathSafe(segment: string): string {
    return segment.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || '_';
}

export class TtsCache {
    private maxSizeMb: number;

    constructor(maxSizeMb: number = DEFAULT_CACHE_MAX_SIZE_MB) {
        this.maxSizeMb = maxSizeMb;
    }

    /** Metadata lives in SQLite, so there is no async warm-up phase. */
    async ensureReady(): Promise<void> {
        return;
    }

    async setMaxSize(mb: number): Promise<void> {
        this.maxSizeMb = mb;
        await this.evictIfNeeded();
    }

    /** Check if a key exists in cache. Returns a file reference without loading audio into RAM. */
    async lookup(key: TtsCacheKey): Promise<CacheHit | null> {
        const keyStr = this.keyToString(key);
        const entry = ttsCacheRepo.getEntry(keyStr);
        if (!entry) return null;

        if (!(await fileExists(entry.path))) {
            ttsCacheRepo.deleteEntry(keyStr);
            return null;
        }

        ttsCacheRepo.updateLastAccessed(keyStr, Date.now());
        return { path: entry.path, mimeType: entry.mimeType };
    }

    /** Read a cached file from disk and return as TtsSynthesizeResult. */
    async read(hit: CacheHit): Promise<TtsSynthesizeResult> {
        const data = await readFile(hit.path);
        return { audioBase64: data.toString('base64'), mimeType: hit.mimeType };
    }

    /** Store a synthesis result to disk cache. */
    async set(key: TtsCacheKey, result: TtsSynthesizeResult): Promise<CacheHit> {
        const dir = join(
            getTtsCacheDir(),
            ...[key.provider, key.model, key.voiceId, key.language].map(pathSafe),
        );
        await mkdir(dir, { recursive: true });
        const ext = result.mimeType.split('/')[1] || 'bin';
        const filePath = join(dir, `${key.textHash}.${ext}`);
        const buf = Buffer.from(result.audioBase64, 'base64');
        await writeFile(filePath, buf);
        const now = Date.now();
        ttsCacheRepo.upsertEntry({
            cacheKey: this.keyToString(key),
            path: filePath,
            sizeBytes: buf.length,
            mimeType: result.mimeType,
            lastAccessed: now,
            createdAt: now,
        });
        await this.evictIfNeeded();
        return { path: filePath, mimeType: result.mimeType };
    }

    async clear(): Promise<void> {
        const cacheDir = getTtsCacheDir();
        const deletePromises: Promise<void>[] = [];
        for (const entry of ttsCacheRepo.getAllEntries()) {
            deletePromises.push(unlink(entry.path).catch(() => {}));
        }
        await Promise.all(deletePromises);
        for (const sub of TTS_PROVIDER_TYPES) {
            const subDir = join(cacheDir, sub);
            if (await fileExists(subDir)) {
                await rm(subDir, { recursive: true, force: true }).catch(() => {});
            }
        }
        ttsCacheRepo.clearAllEntries();
    }

    getSize(): number {
        return ttsCacheRepo.getTotalSizeBytes();
    }

    /** Metadata writes are immediate, so flush is intentionally a no-op. */
    async flush(): Promise<void> {
        return;
    }

    private async evictIfNeeded(): Promise<void> {
        const maxBytes = this.maxSizeMb * 1024 * 1024;
        let total = ttsCacheRepo.getTotalSizeBytes();
        while (total > maxBytes) {
            const candidates = ttsCacheRepo.getOldestEntries(EVICTION_BATCH_SIZE);
            if (candidates.length === 0) break;

            for (const entry of candidates) {
                if (total <= maxBytes) break;
                await unlink(entry.path).catch(() => {});
                total -= entry.sizeBytes;
                ttsCacheRepo.deleteEntry(entry.cacheKey);
            }
        }
    }

    private keyToString(key: TtsCacheKey): string {
        return `${key.provider}:${key.model}:${key.voiceId}:${key.language}:${key.rate}:${key.textHash}`;
    }
}
