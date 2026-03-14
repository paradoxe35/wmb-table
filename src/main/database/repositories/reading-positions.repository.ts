import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { readingPositions } from '../schema';
import type { ReadingPosition } from '@shared/types';
import { logChange } from '@main/services/sync/change-log.service';

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
    const updatedAt = new Date().toISOString();
    const existing = db
        .select()
        .from(readingPositions)
        .where(eq(readingPositions.documentKey, documentKey))
        .get();

    if (existing) {
        db.update(readingPositions)
            .set({ scrollY, scrollX, updatedAt })
            .where(eq(readingPositions.documentKey, documentKey))
            .run();
    } else {
        db.insert(readingPositions)
            .values({
                documentKey,
                scrollY,
                scrollX,
                updatedAt,
            })
            .run();
    }

    logChange('reading_positions', documentKey, 'SAVE', {
        documentKey,
        scrollY,
        scrollX,
        updatedAt,
    });

    return { documentKey, scrollY, scrollX };
}
