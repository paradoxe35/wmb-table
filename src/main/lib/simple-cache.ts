import * as kvRepo from '@main/database/repositories/kv-cache.repository';

/**
 * Simple persistent cache backed by the app's SQLite database.
 *
 * Usage:
 *   const voiceCache = new SimpleCache<Voice[]>('edge-voices', 24 * 60 * 60 * 1000);
 *   const voices = await voiceCache.getOrFetch(() => fetchFromNetwork());
 */
export class SimpleCache<T> {
    constructor(
        private readonly key: string,
        private readonly ttlMs?: number,
    ) {}

    /** Get the cached value, or null if missing/expired. */
    get(): T | null {
        return kvRepo.get<T>(this.key);
    }

    /** Get the cached value even if expired (fallback for offline use). */
    getStale(): T | null {
        return kvRepo.getStale<T>(this.key);
    }

    /** Set a value in the cache. */
    set(value: T): void {
        kvRepo.set(this.key, value, this.ttlMs);
    }

    /** Remove the cached value. */
    remove(): void {
        kvRepo.remove(this.key);
    }

    /**
     * Get the cached value if fresh, otherwise call `fetchFn` to get a new value.
     * If `fetchFn` fails and a stale value exists, returns the stale value.
     */
    async getOrFetch(fetchFn: () => Promise<T>): Promise<T> {
        const fresh = this.get();
        if (fresh !== null) return fresh;

        try {
            const value = await fetchFn();
            this.set(value);
            return value;
        } catch (err) {
            const stale = this.getStale();
            if (stale !== null) return stale;
            throw err;
        }
    }
}
