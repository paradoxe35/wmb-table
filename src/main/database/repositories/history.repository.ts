import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { history, historyItems } from '../schema';
import type {
    DocumentIdentity,
    HistoryData,
    HistoryDataItem,
    HistoryEntryCreateData,
} from '@shared/types';
import { documentIdentityEquals } from '@shared/types';

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

function parseDocumentIdentity(raw: string): DocumentIdentity {
    return JSON.parse(raw) as DocumentIdentity;
}

function toHistoryItem(row: typeof historyItems.$inferSelect): HistoryDataItem {
    return {
        id: row.id,
        historyId: row.historyId,
        date: row.date,
        time: row.time,
        documentTitle: row.documentTitle,
        documentIdentity: parseDocumentIdentity(row.documentIdentity),
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
    languageCode: string,
    entry: HistoryEntryCreateData,
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
            const idsToDelete = all.slice(0, all.length - MAX_HISTORY + 1).map((r) => r.id);
            db.delete(history).where(inArray(history.id, idsToDelete)).run();
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        db.insert(history)
            .values({ id, date, milliseconds, languageCode, createdAt: now, updatedAt: now })
            .run();
        historyRow = db.select().from(history).where(eq(history.id, id)).get()!;
    }

    // Skip if the most recent entry is the same document
    const lastItem = db
        .select()
        .from(historyItems)
        .where(eq(historyItems.historyId, historyRow.id))
        .orderBy(desc(historyItems.createdAt))
        .limit(1)
        .get();

    if (
        lastItem?.documentIdentity &&
        documentIdentityEquals(
            parseDocumentIdentity(lastItem.documentIdentity),
            entry.documentIdentity,
        )
    ) {
        return;
    }

    // Enforce item cap per history
    const items = db
        .select()
        .from(historyItems)
        .where(eq(historyItems.historyId, historyRow.id))
        .orderBy(asc(historyItems.createdAt))
        .all();

    if (items.length >= MAX_ITEMS_PER_HISTORY) {
        const idsToDelete = items
            .slice(0, items.length - MAX_ITEMS_PER_HISTORY + 1)
            .map((r) => r.id);
        db.delete(historyItems).where(inArray(historyItems.id, idsToDelete)).run();
    }

    const itemId = randomUUID();
    const now = new Date().toISOString();
    db.insert(historyItems)
        .values({
            id: itemId,
            historyId: historyRow.id,
            date,
            time,
            documentTitle: entry.documentTitle,
            documentIdentity: JSON.stringify(entry.documentIdentity),
            createdAt: now,
            updatedAt: now,
        })
        .run();
}
