import { eq, and, desc, or, like, sql, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../index';
import { highlights } from '../schema';
import { logChange } from '@main/services/sync/change-log.service';
import type {
    DocumentIdentity,
    HighlightCreateData,
    HighlightItem,
    HighlightSearchResult,
    HighlightUpdateData,
} from '@shared/types';
import { getDocumentIdentityKey } from '@shared/types';

function parseDocumentIdentity(raw: string): DocumentIdentity {
    return JSON.parse(raw) as DocumentIdentity;
}

function toHighlightItem(row: typeof highlights.$inferSelect): HighlightItem {
    return {
        id: row.id,
        groupId: row.groupId,
        documentTitle: row.documentTitle,
        documentIdentity: parseDocumentIdentity(row.documentIdentity),
        paragraphIndex: row.paragraphIndex,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
        textSnippet: row.textSnippet,
        color: row.color,
        comment: row.comment ?? undefined,
        languageCode: row.languageCode,
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
    };
}

const DEFAULT_PAGE_SIZE = 20;

export function search(
    query: string,
    page: number,
    pageSize: number = DEFAULT_PAGE_SIZE,
    languageCode?: string,
): HighlightSearchResult {
    const db = getDb();
    const offset = page * pageSize;

    const searchFilter = query.trim()
        ? or(
              like(highlights.documentTitle, `%${query}%`),
              like(highlights.textSnippet, `%${query}%`),
              like(highlights.comment, `%${query}%`),
          )
        : undefined;

    // Filter by language for sermon/bible, but keep custom documents (language-independent).
    // The document type now lives only inside document_identity JSON.
    const langFilter = languageCode
        ? or(
              sql`json_extract(${highlights.documentIdentity}, '$.documentType') = 'custom'`,
              eq(highlights.languageCode, languageCode),
          )
        : undefined;

    const conditions = and(searchFilter, langFilter);

    const totalRow = db
        .select({ count: sql<number>`count(distinct ${highlights.groupId})` })
        .from(highlights)
        .where(conditions)
        .get();
    const total = totalRow?.count ?? 0;

    // Get distinct groupIds with pagination
    const groupRows = db
        .selectDistinct({ groupId: highlights.groupId, createdAt: highlights.createdAt })
        .from(highlights)
        .where(conditions)
        .orderBy(desc(highlights.createdAt))
        .limit(pageSize)
        .offset(offset)
        .all();

    if (groupRows.length === 0) {
        return { items: [], total, page, pageSize, hasMore: false };
    }

    // Fetch all rows for the matched groups
    const groupIds = groupRows.map((r) => r.groupId);
    const items = db
        .select()
        .from(highlights)
        .where(
            and(
                sql`${highlights.groupId} IN (${sql.join(
                    groupIds.map((id) => sql`${id}`),
                    sql`, `,
                )})`,
                conditions,
            ),
        )
        .orderBy(desc(highlights.createdAt))
        .all()
        .map(toHighlightItem);

    return {
        items,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    };
}

export function getByDocument(documentIdentity: DocumentIdentity): HighlightItem[] {
    return getDb()
        .select()
        .from(highlights)
        .where(eq(highlights.documentKey, getDocumentIdentityKey(documentIdentity)))
        .all()
        .map(toHighlightItem);
}

export function create(data: HighlightCreateData): HighlightItem[] {
    const groupId = randomUUID();
    const now = new Date().toISOString();
    const results: HighlightItem[] = [];

    const allValues = data.paragraphs.map((p) => ({
        id: randomUUID(),
        groupId,
        documentKey: getDocumentIdentityKey(data.documentIdentity),
        documentTitle: data.documentTitle,
        documentIdentity: JSON.stringify(data.documentIdentity),
        paragraphIndex: p.paragraphIndex,
        startOffset: p.startOffset,
        endOffset: p.endOffset,
        textSnippet: data.textSnippet,
        color: data.color,
        comment: data.comment ?? null,
        languageCode: data.languageCode,
        createdAt: now,
        updatedAt: now,
    }));

    getDb().insert(highlights).values(allValues).run();
    for (const values of allValues) {
        logChange('highlights', values.id, 'SAVE', values);
        results.push(toHighlightItem({ ...values, comment: values.comment }));
    }

    return results;
}

export function update(id: string, data: HighlightUpdateData): HighlightItem | null {
    const db = getDb();
    const existing = db.select().from(highlights).where(eq(highlights.id, id)).get();
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated = {
        color: data.color ?? existing.color,
        comment: data.comment !== undefined ? data.comment : existing.comment,
        updatedAt: now,
    };
    db.update(highlights).set(updated).where(eq(highlights.id, id)).run();

    const row = { ...existing, ...updated };
    logChange('highlights', id, 'SAVE', row);
    return toHighlightItem(row);
}

export function deleteHighlight(id: string): void {
    const db = getDb();
    // Find the highlight to check if it belongs to a group
    const existing = db.select().from(highlights).where(eq(highlights.id, id)).get();
    if (!existing) return;

    if (existing.groupId) {
        // Delete all highlights in the same group
        const group = db
            .select()
            .from(highlights)
            .where(eq(highlights.groupId, existing.groupId))
            .all();

        const idsToDelete = group.map((row) => row.id);
        db.delete(highlights).where(inArray(highlights.id, idsToDelete)).run();

        for (const row of group) {
            logChange('highlights', row.id, 'DELETE', { id: row.id });
        }
    } else {
        db.delete(highlights).where(eq(highlights.id, id)).run();
        logChange('highlights', id, 'DELETE', { id });
    }
}
