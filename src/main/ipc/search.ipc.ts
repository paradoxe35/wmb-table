import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';
import { searchSermons } from '@main/services/search.service';
import { DEFAULT_SEARCH_MODE } from '@shared/constants';
import type {
    TantivySearchHit,
    SearchMode,
    SimilarSermonHit,
    SearchSnippet,
    MatchingParagraphSnippet,
} from '@shared/types';
import { getHighlightRanges, paragraphHasMatch } from '@shared/searchable';

const ITEMS_PER_PAGE = 20;

function mergeOverlappingRanges(
    ranges: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
    if (ranges.length === 0) return [];
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const prev = merged[merged.length - 1];
        if (sorted[i].start <= prev.end) {
            prev.end = Math.max(prev.end, sorted[i].end);
        } else {
            merged.push({ ...sorted[i] });
        }
    }
    return merged;
}

/** Build search snippets with sequential paragraph indices for navigation. */
async function buildSearchSnippets(
    langCode: string,
    query: string,
    mode: SearchMode,
    translationId: number,
    sermonDate: number,
    rawSnippets: MatchingParagraphSnippet[],
): Promise<SearchSnippet[]> {
    const paragraphs = await tantivyService.getSermonParagraphs(
        langCode,
        translationId,
        sermonDate,
    );
    const snippetByParagraph = new Map(rawSnippets.map((s) => [s.paragraphIndex, s]));

    // Build snippets with sequential matchIndex (index among matching paragraphs)
    let matchIdx = 0;
    return paragraphs.flatMap((paragraph) => {
        const snippet = snippetByParagraph.get(paragraph.paragraphIndex);
        if (!snippet) return [];
        if (!paragraphHasMatch(paragraph.content, query, mode)) return [];

        // Merge regex + Tantivy highlights (Tantivy catches fuzzy matches for all/any)
        const regexHl = getHighlightRanges(snippet.snippet, query, mode);
        const tantivyHl = mode !== 'exact' ? (snippet.highlights ?? []) : [];
        const highlights = mergeOverlappingRanges([...regexHl, ...tantivyHl]);

        return [
            {
                paragraphIndex: snippet.paragraphIndex,
                snippet: snippet.snippet,
                matchIndex: matchIdx++,
                highlights,
            },
        ];
    });
}

export function registerSearchHandlers(): void {
    registerHandler(SearchChannels.getSuggestions, async (_event, langCode) => {
        return suggestionsRepo.getSuggestions(langCode);
    });

    registerHandler(SearchChannels.addSuggestion, async (_event, searchText, found, langCode) => {
        return suggestionsRepo.addSuggestion(searchText, found, langCode);
    });

    registerHandler(SearchChannels.searchText, async (_event, langCode, query, page, mode) => {
        const searchMode: SearchMode = mode ?? DEFAULT_SEARCH_MODE;
        const offset = (page - 1) * ITEMS_PER_PAGE;

        const { matches, total } = await searchSermons({
            langCode,
            query,
            mode: searchMode,
            limit: ITEMS_PER_PAGE,
            offset,
        });

        const hits: TantivySearchHit[] = [];
        for (const match of matches) {
            const snippets = await buildSearchSnippets(
                langCode,
                query,
                searchMode,
                match.translationId,
                match.tantivySermonDate,
                match.snippets,
            );
            if (snippets.length === 0) continue;

            hits.push({
                translationId: match.translationId,
                sermonId: match.sermonId,
                title: match.title,
                snippets,
                score: match.score,
                hitCount: snippets.length,
                paragraphIndex: match.bestParagraphIndex,
            });
        }

        return { hits, total, query };
    });

    registerHandler(SearchChannels.searchContent, async (_event, langCode, query, sermonDateMs) => {
        const result = await tantivyService.searchSermons(langCode, query, 1, 0);
        const hit = result.hits.find((h) => h.tantivySermonDate === sermonDateMs);
        if (!hit) return '';
        return await tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
    });

    registerHandler(
        SearchChannels.findSimilarSermons,
        async (_event, langCode, translationId, sermonDate, paragraphIndex, limit) => {
            const result = await tantivyService.findSimilarSermons(
                langCode,
                translationId,
                sermonDate,
                paragraphIndex,
                limit ?? 20,
            );

            const allDates = result.hits.map((h) => h.tantivySermonDate);
            const dateToSermonIds = refRepo.tantivyDatesToSermonIds(allDates);

            const hits: SimilarSermonHit[] = [];
            for (const hit of result.hits) {
                const sermonId = (dateToSermonIds.get(hit.tantivySermonDate) ?? [])[0];
                if (!sermonId) continue;
                const meta = referenceDataService.getSermonMeta(
                    hit.translationId,
                    langCode,
                    sermonId,
                );
                hits.push({
                    sermonId,
                    title: meta?.title ?? meta?.enTitle ?? sermonId,
                    translationId: hit.translationId,
                    paragraphs: hit.paragraphs.map((p) => ({
                        paragraphIndex: p.paragraphIndex,
                        snippet: p.snippet.slice(0, 300),
                        score: p.score,
                    })),
                    score: hit.score,
                });
            }

            return { hits, total: result.total };
        },
    );
}
