import { readFile, writeFile, unlink, rm, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import log from 'electron-log';
import { getTtsCacheDir } from '@main/lib/app-paths';
import type { TtsCacheKey, TtsSynthesizeResult } from '@shared/tts.types';

interface CacheEntry {
    path: string;
    sizeBytes: number;
    mimeType: string;
    lastAccessed: number;
    createdAt: number;
}

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

export class TtsCache {
    private entries = new Map<string, CacheEntry>();
    private indexPath: string;
    private maxSizeMb: number;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private ready: Promise<void>;

    constructor(maxSizeMb: number = 500) {
        this.maxSizeMb = maxSizeMb;
        this.indexPath = join(getTtsCacheDir(), 'cache-index.json');
        this.ready = this.loadIndex();
    }

    /** Wait for the cache to be ready (index loaded). */
    async ensureReady(): Promise<void> {
        await this.ready;
    }

    async setMaxSize(mb: number): Promise<void> {
        this.maxSizeMb = mb;
        await this.evictIfNeeded();
    }

    /** Check if a key exists in cache. Returns a file reference without loading audio into RAM. */
    async lookup(key: TtsCacheKey): Promise<CacheHit | null> {
        await this.ready;
        const keyStr = this.keyToString(key);
        const entry = this.entries.get(keyStr);
        if (!entry) return null;
        if (!(await fileExists(entry.path))) {
            this.entries.delete(keyStr);
            this.scheduleSave();
            return null;
        }
        entry.lastAccessed = Date.now();
        return { path: entry.path, mimeType: entry.mimeType };
    }

    /** Read a cached file from disk and return as TtsSynthesizeResult. */
    async read(hit: CacheHit): Promise<TtsSynthesizeResult> {
        const data = await readFile(hit.path);
        return { audioBase64: data.toString('base64'), mimeType: hit.mimeType };
    }

    /** Store a synthesis result to disk cache. */
    async set(key: TtsCacheKey, result: TtsSynthesizeResult): Promise<void> {
        await this.ready;
        const dir = join(getTtsCacheDir(), key.provider, key.model, key.voiceId, key.language);
        await mkdir(dir, { recursive: true });
        const ext = result.mimeType.split('/')[1] || 'bin';
        const filePath = join(dir, `${key.textHash}.${ext}`);
        const buf = Buffer.from(result.audioBase64, 'base64');
        await writeFile(filePath, buf);
        this.entries.set(this.keyToString(key), {
            path: filePath,
            sizeBytes: buf.length,
            mimeType: result.mimeType,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
        });
        await this.evictIfNeeded();
        this.scheduleSave();
    }

    async clear(): Promise<void> {
        await this.ready;
        const cacheDir = getTtsCacheDir();
        const deletePromises: Promise<void>[] = [];
        for (const entry of this.entries.values()) {
            deletePromises.push(unlink(entry.path).catch(() => {}));
        }
        await Promise.all(deletePromises);
        this.entries.clear();
        for (const sub of ['browser', 'kokoro', 'qwen', 'openai']) {
            const subDir = join(cacheDir, sub);
            if (await fileExists(subDir)) {
                await rm(subDir, { recursive: true, force: true }).catch(() => {});
            }
        }
        this.scheduleSave();
    }

    getSize(): number {
        let total = 0;
        for (const entry of this.entries.values()) {
            total += entry.sizeBytes;
        }
        return total;
    }

    async flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        try {
            await mkdir(join(this.indexPath, '..'), { recursive: true });
            await writeFile(this.indexPath, JSON.stringify([...this.entries.entries()]));
        } catch (err) {
            log.warn('Failed to flush TTS cache index:', err);
        }
    }

    private async evictIfNeeded(): Promise<void> {
        const maxBytes = this.maxSizeMb * 1024 * 1024;
        let total = this.getSize();
        if (total <= maxBytes) return;

        const sorted = [...this.entries.entries()].sort(
            (a, b) => a[1].lastAccessed - b[1].lastAccessed,
        );
        for (const [key, entry] of sorted) {
            if (total <= maxBytes) break;
            await unlink(entry.path).catch(() => {});
            total -= entry.sizeBytes;
            this.entries.delete(key);
        }
    }

    private keyToString(key: TtsCacheKey): string {
        return `${key.provider}:${key.model}:${key.voiceId}:${key.language}:${key.rate}:${key.textHash}`;
    }

    private async loadIndex(): Promise<void> {
        try {
            if (await fileExists(this.indexPath)) {
                const raw = await readFile(this.indexPath, 'utf-8');
                if (!raw.trim()) return; // empty file — nothing to load
                const data = JSON.parse(raw);
                if (Array.isArray(data)) {
                    for (const [k, v] of data) {
                        this.entries.set(k, v);
                    }
                }
            }
        } catch (err) {
            log.warn('Failed to load TTS cache index, starting fresh:', err);
            this.entries.clear();
        }
    }

    /** Debounced async save — avoids writing on every single cache operation. */
    private scheduleSave(): void {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await writeFile(this.indexPath, JSON.stringify([...this.entries.entries()]));
            } catch (err) {
                log.warn('Failed to save TTS cache index:', err);
            }
        }, 500);
    }
}
