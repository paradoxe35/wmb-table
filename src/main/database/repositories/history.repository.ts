import { eq, and, desc, asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { history, historyItems } from '../schema';
import type { HistoryData, HistoryDataItem } from '@shared/types';

const MAX_HISTORY = 30;
const MAX_ITEMS_PER_HISTORY = 50;

function toHistoryData(row: typeof history.$inferSelect): HistoryData {
    return {
        id: row.id,
        date: row.date,
        milliseconds: row.milliseconds,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

function toHistoryItem(row: typeof historyItems.$inferSelect): HistoryDataItem {
    return {
        id: row.id,
        historyId: row.historyId,
        date: row.date,
        time: row.time,
        documentTitle: row.documentTitle,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function getHistory(languageCode: string): HistoryData[] {
    return getDb()
        .select()
        .from(history)
        .where(eq(history.languageCode, languageCode))
        .orderBy(desc(history.milliseconds))
        .all()
        .map(toHistoryData);
}

export function getHistoryItems(historyId: string): HistoryDataItem[] {
    return getDb()
        .select()
        .from(historyItems)
        .where(eq(historyItems.historyId, historyId))
        .orderBy(desc(historyItems.createdAt))
        .all()
        .map(toHistoryItem);
}

export function addHistoryEntry(
    date: string,
    milliseconds: number,
    time: string,
    documentTitle: string,
    languageCode: string,
): void {
    const db = getDb();

    // Find or create history row for this date + language
    let historyRow = db
        .select()
        .from(history)
        .where(and(eq(history.milliseconds, milliseconds), eq(history.languageCode, languageCode)))
        .get();

    if (!historyRow) {
        // Enforce 30-entry cap per language
        const all = db
            .select()
            .from(history)
            .where(eq(history.languageCode, languageCode))
            .orderBy(asc(history.milliseconds))
            .all();
        if (all.length >= MAX_HISTORY) {
            const toDelete = all.slice(0, all.length - MAX_HISTORY + 1);
            for (const old of toDelete) {
                db.delete(history).where(eq(history.id, old.id)).run();
            }
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        db.insert(history)
            .values({ id, date, milliseconds, languageCode, createdAt: now, updatedAt: now })
            .run();
        historyRow = db.select().from(history).where(eq(history.id, id)).get()!;
    }

    // Enforce item cap per history
    const items = db
        .select()
        .from(historyItems)
        .where(eq(historyItems.historyId, historyRow.id))
        .orderBy(asc(historyItems.createdAt))
        .all();

    if (items.length >= MAX_ITEMS_PER_HISTORY) {
        const toDelete = items.slice(0, items.length - MAX_ITEMS_PER_HISTORY + 1);
        for (const old of toDelete) {
            db.delete(historyItems).where(eq(historyItems.id, old.id)).run();
        }
    }

    const itemId = randomUUID();
    const now = new Date().toISOString();
    db.insert(historyItems)
        .values({
            id: itemId,
            historyId: historyRow.id,
            date,
            time,
            documentTitle,
            createdAt: now,
            updatedAt: now,
        })
        .run();
}
