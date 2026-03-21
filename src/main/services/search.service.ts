/**
 * Shared search logic used by both the IPC search handler and the AI tools.
 *
 * Passes the raw user query and search mode to the Tantivy worker, which
 * builds native Query objects (phraseQuery, booleanQuery, termQuery) — no
 * string formatting or query parser hacks needed.
 */
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';
import type { SearchMode, MatchingParagraphSnippet } from '@shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchedSermon {
    sermonId: string;
    translationId: number;
    tantivySermonDate: number;
    score: number;
    bestParagraphIndex: number;
    title: string;
    snippets: MatchingParagraphSnippet[];
}

export interface SearchSermonsOptions {
    langCode: string;
    query: string;
    mode: SearchMode;
    limit: number;
    offset: number;
}

export interface SearchSermonsResult {
    matches: MatchedSermon[];
    total: number;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * Search sermons using Tantivy's native query APIs.
 *
 * The worker builds the correct query type based on mode:
 *   - **any**: boolean OR (any word matches)
 *   - **all**: boolean AND (all words required)
 *   - **exact**: phrase query with slop (proximity matching)
 *
 * Tantivy handles all filtering natively — pagination is always correct.
 */
export async function searchSermons(opts: SearchSermonsOptions): Promise<SearchSermonsResult> {
    const { langCode, query, mode, limit, offset } = opts;

    const result = await tantivyService.searchSermons(langCode, query, limit, offset, mode);
    const allDates = result.hits.map((h) => h.tantivySermonDate);
    const dateToSermonIds = refRepo.tantivyDatesToSermonIds(allDates);

    const matches: MatchedSermon[] = [];
    for (const hit of result.hits) {
        const sermonId = (dateToSermonIds.get(hit.tantivySermonDate) ?? [])[0];
        if (!sermonId) continue;

        const rawSnippets = await tantivyService.getMatchingParagraphs(
            langCode,
            query,
            hit.translationId,
            hit.tantivySermonDate,
            mode,
        );
        if (rawSnippets.length === 0) continue;

        const meta = referenceDataService.getSermonMeta(hit.translationId, langCode, sermonId);
        matches.push({
            sermonId,
            translationId: hit.translationId,
            tantivySermonDate: hit.tantivySermonDate,
            score: hit.score,
            bestParagraphIndex: hit.bestParagraphIndex,
            title: meta?.title ?? meta?.enTitle ?? sermonId,
            snippets: rawSnippets,
        });
    }

    return { matches, total: result.total };
}
