import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { suggestions } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type { Suggestions } from '@shared/types';

const MAX_SUGGESTIONS = 20;

function toSuggestion(row: typeof suggestions.$inferSelect): Suggestions {
    return {
        id: row.id,
        searchText: row.searchText,
        found: row.found,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

export function getSuggestions(): Suggestions[] {
    return getDb().select().from(suggestions).all().map(toSuggestion);
}

export function addSuggestion(searchText: string, found: number): Suggestions {
    const db = getDb();
    const now = new Date().toISOString();
    const id = randomUUID();

    db.insert(suggestions)
        .values({ id, searchText, found, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
            target: suggestions.searchText,
            set: { found, updatedAt: now },
        })
        .run();

    // Enforce cap
    const all = db.select().from(suggestions).orderBy(asc(suggestions.createdAt)).all();
    if (all.length > MAX_SUGGESTIONS) {
        const toDelete = all.slice(0, all.length - MAX_SUGGESTIONS);
        for (const old of toDelete) {
            db.delete(suggestions).where(eq(suggestions.id, old.id)).run();
        }
    }

    const row = db.select().from(suggestions).where(eq(suggestions.searchText, searchText)).get();
    if (row) logChange('suggestions', row.id, 'SAVE', row);
    return toSuggestion(row!);
}
