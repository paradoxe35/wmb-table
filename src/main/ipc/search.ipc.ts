import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';
import type { TantivySearchHit, SearchMode } from '@shared/types';
import { strNormalizeNoLower, matchesQuery, buildHighlightRegex } from '@shared/searchable';

const ITEMS_PER_PAGE = 20;

function countSnippetMatches(text: string, query: string, mode: SearchMode): number {
    const highlightRegex = buildHighlightRegex(query, mode);
    if (!highlightRegex) return 0;
    highlightRegex.lastIndex = 0;
    return [...strNormalizeNoLower(text).matchAll(highlightRegex)].length;
}

async function attachSnippetMatchIndices(
    langCode: string,
    query: string,
    mode: SearchMode,
    translationId: number,
    sermonDate: number,
    snippets: { paragraphIndex: number; snippet: string }[],
) {
    const paragraphs = await tantivyService.getSermonParagraphs(
        langCode,
        translationId,
        sermonDate,
    );
    const snippetByParagraph = new Map(
        snippets.map((snippet) => [snippet.paragraphIndex, snippet]),
    );
    let cumulativeMatchIndex = 0;

    return paragraphs.flatMap((paragraph) => {
        const paragraphMatchCount = countSnippetMatches(paragraph.content, query, mode);
        const snippet = snippetByParagraph.get(paragraph.paragraphIndex);
        const result = snippet
            ? [
                  {
                      ...snippet,
                      matchIndex: cumulativeMatchIndex,
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
        const searchMode: SearchMode = mode ?? 'any';
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const result = await tantivyService.searchSermons(langCode, query, ITEMS_PER_PAGE, offset);

        const highlightRegex = buildHighlightRegex(query, searchMode);
        // Batch resolve all sermon dates in one query
        const allDates = result.hits.map((h) => h.tantivySermonDate);
        const dateToSermonIds = refRepo.tantivyDatesToSermonIds(allDates);

        const hits: TantivySearchHit[] = [];
        for (const hit of result.hits) {
            const sermonIds = dateToSermonIds.get(hit.tantivySermonDate) ?? [];
            const sermonId = sermonIds[0];
            if (!sermonId) continue;

            const meta = referenceDataService.getSermonMeta(hit.translationId, langCode, sermonId);
            const rawSnippets = await tantivyService.getMatchingParagraphs(
                langCode,
                query,
                hit.translationId,
                hit.tantivySermonDate,
            );
            const filteredSnippets = rawSnippets.filter((p) =>
                matchesQuery(strNormalizeNoLower(p.snippet), query, searchMode),
            );
            const snippets = await attachSnippetMatchIndices(
                langCode,
                query,
                searchMode,
                hit.translationId,
                hit.tantivySermonDate,
                filteredSnippets,
            );
            if (snippets.length === 0) continue;
            const hitCount = highlightRegex
                ? snippets.reduce(
                      (count, s) => count + countSnippetMatches(s.snippet, query, searchMode),
                      0,
                  )
                : snippets.length;
            hits.push({
                translationId: hit.translationId,
                sermonId,
                title: meta?.title ?? meta?.enTitle ?? sermonId,
                snippets,
                score: hit.score,
                hitCount,
                paragraphIndex: hit.bestParagraphIndex,
            });
        }

        return { hits, total: result.total, query };
    });

    registerHandler(SearchChannels.searchContent, async (_event, langCode, query, sermonDateMs) => {
        const result = await tantivyService.searchSermons(langCode, query, 1, 0);
        const hit = result.hits.find((h) => h.tantivySermonDate === sermonDateMs);
        if (!hit) return '';
        return await tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
    });
}
