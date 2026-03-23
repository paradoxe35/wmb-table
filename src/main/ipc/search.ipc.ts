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
import { strNormalizeNoLower, buildHighlightRegex } from '@shared/searchable';

const ITEMS_PER_PAGE = 20;

/**
 * Count regex matches — MUST use the same regex as the frontend's
 * sermon-paragraph.tsx so matchIndex aligns with data-match-index.
 */
function countMatches(text: string, query: string, mode: SearchMode): number {
    const regex = buildHighlightRegex(query, mode);
    if (!regex) return 0;
    regex.lastIndex = 0;
    return [...strNormalizeNoLower(text).matchAll(regex)].length;
}

/**
 * Assign cumulative match indices to snippets for scroll-to-match navigation.
 * Match counting uses the SAME regex as the frontend renderer to ensure
 * matchIndex aligns with the rendered data-match-index attributes.
 * Tantivy highlights are passed through for search result snippet display.
 */
async function attachSnippetMatchIndices(
    langCode: string,
    query: string,
    mode: SearchMode,
    translationId: number,
    sermonDate: number,
    snippets: MatchingParagraphSnippet[],
): Promise<SearchSnippet[]> {
    const paragraphs = await tantivyService.getSermonParagraphs(
        langCode,
        translationId,
        sermonDate,
    );
    const snippetByParagraph = new Map(snippets.map((s) => [s.paragraphIndex, s]));
    let cumulativeMatchIndex = 0;

    return paragraphs.flatMap((paragraph) => {
        const paragraphMatchCount = countMatches(paragraph.content, query, mode);
        const snippet = snippetByParagraph.get(paragraph.paragraphIndex);
        const result: SearchSnippet[] = snippet
            ? [
                  {
                      paragraphIndex: snippet.paragraphIndex,
                      snippet: snippet.snippet,
                      matchIndex: cumulativeMatchIndex,
                      highlights: snippet.highlights,
                  },
              ]
            : [];
        cumulativeMatchIndex += paragraphMatchCount;
        return result;
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
            const snippets = await attachSnippetMatchIndices(
                langCode,
                query,
                searchMode,
                match.translationId,
                match.tantivySermonDate,
                match.snippets,
            );
            if (snippets.length === 0) continue;

            const hitCount = snippets.reduce(
                (count, s) => count + countMatches(s.snippet, query, searchMode),
                0,
            );

            hits.push({
                translationId: match.translationId,
                sermonId: match.sermonId,
                title: match.title,
                snippets,
                score: match.score,
                hitCount,
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
