import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { kvCache } from '../schema';

export function get<T>(key: string): T | null {
    const row = getDb().select().from(kvCache).where(eq(kvCache.key, key)).get();
    if (!row) return null;

    // Check expiration
    if (row.expiresAt && Date.now() > row.expiresAt) {
        getDb().delete(kvCache).where(eq(kvCache.key, key)).run();
        return null;
    }

    try {
        return JSON.parse(row.value) as T;
    } catch {
        return null;
    }
}

/**
 * Get a value even if it's expired. Useful as a fallback when the network is unavailable.
 */
export function getStale<T>(key: string): T | null {
    const row = getDb().select().from(kvCache).where(eq(kvCache.key, key)).get();
    if (!row) return null;
    try {
        return JSON.parse(row.value) as T;
    } catch {
        return null;
    }
}

export function set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    getDb()
        .insert(kvCache)
        .values({ key, value: JSON.stringify(value), expiresAt })
        .onConflictDoUpdate({
            target: kvCache.key,
            set: { value: JSON.stringify(value), expiresAt },
        })
        .run();
}

export function remove(key: string): void {
    getDb().delete(kvCache).where(eq(kvCache.key, key)).run();
}
