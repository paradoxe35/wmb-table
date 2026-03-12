import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { readingPositions } from '../schema';
import type { ReadingPosition } from '@shared/types';

export function getReadingPosition(documentKey: string): ReadingPosition | null {
    const row = getDb()
        .select()
        .from(readingPositions)
        .where(eq(readingPositions.documentKey, documentKey))
        .get();

    if (!row) return null;

    return {
        documentKey: row.documentKey,
        scrollY: row.scrollY,
        scrollX: row.scrollX,
    };
}

export function saveReadingPosition(
    documentKey: string,
    scrollY: number,
    scrollX = 0,
): ReadingPosition {
    const db = getDb();
    const existing = db
        .select()
        .from(readingPositions)
        .where(eq(readingPositions.documentKey, documentKey))
        .get();

    if (existing) {
        db.update(readingPositions)
            .set({ scrollY, scrollX, updatedAt: new Date().toISOString() })
            .where(eq(readingPositions.documentKey, documentKey))
            .run();
    } else {
        db.insert(readingPositions)
            .values({
                documentKey,
                scrollY,
                scrollX,
                updatedAt: new Date().toISOString(),
            })
            .run();
    }

    return { documentKey, scrollY, scrollX };
}
