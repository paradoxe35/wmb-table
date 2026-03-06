import { eq, and, asc } from 'drizzle-orm';
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

export function getSuggestions(languageCode: string): Suggestions[] {
    return getDb()
        .select()
        .from(suggestions)
        .where(eq(suggestions.languageCode, languageCode))
        .all()
        .map(toSuggestion);
}

export function addSuggestion(
    searchText: string,
    found: number,
    languageCode: string,
): Suggestions {
    const db = getDb();
    const now = new Date().toISOString();

    // Check if this searchText already exists for this language
    const existing = db
        .select()
        .from(suggestions)
        .where(
            and(eq(suggestions.searchText, searchText), eq(suggestions.languageCode, languageCode)),
        )
        .get();

    if (existing) {
        db.update(suggestions)
            .set({ found, updatedAt: now })
            .where(eq(suggestions.id, existing.id))
            .run();
    } else {
        const id = randomUUID();
        db.insert(suggestions)
            .values({ id, searchText, found, languageCode, createdAt: now, updatedAt: now })
            .run();
    }

    // Enforce cap per language
    const all = db
        .select()
        .from(suggestions)
        .where(eq(suggestions.languageCode, languageCode))
        .orderBy(asc(suggestions.createdAt))
        .all();
    if (all.length > MAX_SUGGESTIONS) {
        const toDelete = all.slice(0, all.length - MAX_SUGGESTIONS);
        for (const old of toDelete) {
            db.delete(suggestions).where(eq(suggestions.id, old.id)).run();
        }
    }

    const row = db
        .select()
        .from(suggestions)
        .where(
            and(eq(suggestions.searchText, searchText), eq(suggestions.languageCode, languageCode)),
        )
        .get();
    if (row) logChange('suggestions', row.id, 'SAVE', row);
    return toSuggestion(row!);
}
