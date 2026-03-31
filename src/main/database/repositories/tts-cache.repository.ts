import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../index';
import { ttsCacheEntries } from '../schema';

export interface TtsCacheEntryRecord {
    cacheKey: string;
    path: string;
    sizeBytes: number;
    mimeType: string;
    lastAccessed: number;
    createdAt: number;
}

export function getEntry(cacheKey: string): TtsCacheEntryRecord | null {
    return (
        getDb()
            .select()
            .from(ttsCacheEntries)
            .where(eq(ttsCacheEntries.cacheKey, cacheKey))
            .get() ?? null
    );
}

export function getAllEntries(): TtsCacheEntryRecord[] {
    return getDb().select().from(ttsCacheEntries).all();
}

export function upsertEntry(entry: TtsCacheEntryRecord): void {
    getDb()
        .insert(ttsCacheEntries)
        .values(entry)
        .onConflictDoUpdate({
            target: ttsCacheEntries.cacheKey,
            set: {
                path: entry.path,
                sizeBytes: entry.sizeBytes,
                mimeType: entry.mimeType,
                lastAccessed: entry.lastAccessed,
                createdAt: entry.createdAt,
            },
        })
        .run();
}

export function updateLastAccessed(cacheKey: string, lastAccessed: number): void {
    getDb()
        .update(ttsCacheEntries)
        .set({ lastAccessed })
        .where(eq(ttsCacheEntries.cacheKey, cacheKey))
        .run();
}

export function deleteEntry(cacheKey: string): void {
    getDb().delete(ttsCacheEntries).where(eq(ttsCacheEntries.cacheKey, cacheKey)).run();
}

export function clearAllEntries(): void {
    getDb().delete(ttsCacheEntries).run();
}

export function getTotalSizeBytes(): number {
    const row = getDb()
        .select({
            total: sql<number>`coalesce(sum(${ttsCacheEntries.sizeBytes}), 0)`,
        })
        .from(ttsCacheEntries)
        .get();

    return Number(row?.total ?? 0);
}

export function getOldestEntries(limit: number): TtsCacheEntryRecord[] {
    return getDb()
        .select()
        .from(ttsCacheEntries)
        .orderBy(asc(ttsCacheEntries.lastAccessed))
        .limit(limit)
        .all();
}
