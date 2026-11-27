import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { customDocuments } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import { extractSnippetWindow, matchesQuery } from '@shared/searchable';
import type {
    CustomDocument,
    CustomDocumentContent,
    CustomDocumentSearchHit,
    CustomDocumentSearchResult,
    SearchMode,
} from '@shared/types';

export function getCustomDocuments(): CustomDocument[] {
    const rows = getDb()
        .select({
            id: customDocuments.id,
            title: customDocuments.title,
            languageCode: customDocuments.languageCode,
            createdAt: customDocuments.createdAt,
            updatedAt: customDocuments.updatedAt,
        })
        .from(customDocuments)
        .all();
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        languageCode: row.languageCode ?? '',
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    }));
}

export function createCustomDocument(
    title: string,
    content: string,
    languageCode = '',
): CustomDocument {
    const db = getDb();
    const existing = db
        .select()
        .from(customDocuments)
        .where(eq(customDocuments.title, title))
        .get();
    if (existing) {
        throw new Error('Un document avec ce nom existe déjà.');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    db.insert(customDocuments)
        .values({ id, title, content, languageCode, createdAt: now, updatedAt: now })
        .run();
    logChange('custom_documents', id, 'SAVE', {
        id,
        title,
        content,
        languageCode,
        createdAt: now,
        updatedAt: now,
    });
    return {
        id,
        title,
        languageCode,
        createdAt: new Date(now),
        updatedAt: new Date(now),
    };
}

export function getCustomDocumentContent(id: string): CustomDocumentContent | null {
    const row = getDb()
        .select({
            id: customDocuments.id,
            title: customDocuments.title,
            content: customDocuments.content,
            languageCode: customDocuments.languageCode,
        })
        .from(customDocuments)
        .where(eq(customDocuments.id, id))
        .get();
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        languageCode: row.languageCode ?? '',
    };
}

export function toDocumentLines(content: string): string[] {
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return parsed.map((line) => String(line));
        }
    } catch {
        // Stored content can also be plain text.
    }

    return content.split('\n');
}

function searchDocumentLines(
    lines: string[],
    query: string,
    mode: SearchMode,
): Array<{ lineIndex: number; snippet: string }> {
    const matches: Array<{ lineIndex: number; snippet: string }> = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = String(lines[lineIndex] ?? '');
        if (!matchesQuery(line, query, mode)) continue;

        matches.push({
            lineIndex,
            snippet: extractSnippetWindow(line, query, mode, 220).text,
        });
    }

    return matches;
}

export function searchCustomDocuments(input: {
    query: string;
    mode?: SearchMode;
    limit?: number;
    offset?: number;
}): CustomDocumentSearchResult {
    const query = input.query.trim();
    const mode = input.mode ?? 'exact';
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
    const offset = Math.max(input.offset ?? 0, 0);

    if (query.length < 2) {
        return {
            results: [],
            totalDocuments: 0,
            query,
            mode,
            returned: 0,
            hasMore: false,
        };
    }

    const docs = getCustomDocuments();
    const hits: CustomDocumentSearchHit[] = [];

    for (const doc of docs) {
        const fullDoc = getCustomDocumentContent(doc.id);
        if (!fullDoc?.content) continue;

        const lineMatches = searchDocumentLines(toDocumentLines(fullDoc.content), query, mode);
        if (lineMatches.length === 0) continue;

        hits.push({
            documentId: doc.id,
            title: doc.title,
            languageCode: doc.languageCode || undefined,
            matches: lineMatches.slice(0, 5),
            totalMatches: lineMatches.length,
        });
    }

    hits.sort((left, right) => {
        if (right.totalMatches !== left.totalMatches) {
            return right.totalMatches - left.totalMatches;
        }
        return left.title.localeCompare(right.title);
    });

    const results = hits.slice(offset, offset + limit);
    const returned = results.length;

    return {
        results,
        totalDocuments: hits.length,
        query,
        mode,
        returned,
        hasMore: offset + returned < hits.length,
    };
}

export function updateCustomDocumentLanguage(id: string, languageCode: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.update(customDocuments)
        .set({ languageCode, updatedAt: now })
        .where(eq(customDocuments.id, id))
        .run();

    const row = db.select().from(customDocuments).where(eq(customDocuments.id, id)).get();
    if (row) {
        logChange('custom_documents', id, 'SAVE', row);
    }
}

export function deleteCustomDocument(id: string): void {
    getDb().delete(customDocuments).where(eq(customDocuments.id, id)).run();
    logChange('custom_documents', id, 'DELETE', { id });
}
