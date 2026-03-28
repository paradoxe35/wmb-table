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
import { getHighlightRanges } from '@shared/searchable';
import type { SearchMode, SearchSnippet } from '@shared/types';

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
    snippets: SearchSnippet[];
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
    totalIsExact: boolean;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

function mergeOverlappingRanges(
    ranges: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
        const prev = merged[merged.length - 1];
        const current = sorted[i];
        if (current.start <= prev.end) {
            prev.end = Math.max(prev.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

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
    const matchCandidates = await Promise.all(
        result.hits.map(async (hit): Promise<MatchedSermon | null> => {
            const sermonId = (dateToSermonIds.get(hit.tantivySermonDate) ?? [])[0];
            if (!sermonId) return null;

            const rawSnippets = await tantivyService.getMatchingParagraphs(
                langCode,
                query,
                hit.translationId,
                hit.tantivySermonDate,
                mode,
            );
            if (rawSnippets.length === 0) return null;

            const snippets = rawSnippets
                .slice()
                .sort((a, b) => a.paragraphIndex - b.paragraphIndex)
                .map((snippet, matchIndex) => {
                    const regexHighlights = getHighlightRanges(snippet.snippet, query, mode);
                    const tantivyHighlights = snippet.highlights ?? [];

                    return {
                        paragraphIndex: snippet.paragraphIndex,
                        snippet: snippet.snippet,
                        matchIndex,
                        highlights: mergeOverlappingRanges([
                            ...regexHighlights,
                            ...tantivyHighlights,
                        ]),
                    };
                });

            const meta = referenceDataService.getSermonMeta(hit.translationId, langCode, sermonId);
            return {
                sermonId,
                translationId: hit.translationId,
                tantivySermonDate: hit.tantivySermonDate,
                score: hit.score,
                bestParagraphIndex: hit.bestParagraphIndex,
                title: meta?.title ?? meta?.enTitle ?? sermonId,
                snippets,
            };
        }),
    );

    const matches = matchCandidates.filter((match): match is MatchedSermon => match != null);

    return { matches, total: result.total, totalIsExact: result.totalIsExact };
}
