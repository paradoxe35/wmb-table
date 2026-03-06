import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';
import type { TantivySearchHit } from '@shared/types';

const ITEMS_PER_PAGE = 20;

export function registerSearchHandlers(): void {
    registerHandler(SearchChannels.getSuggestions, async (_event, langCode) => {
        return suggestionsRepo.getSuggestions(langCode);
    });

    registerHandler(SearchChannels.addSuggestion, async (_event, searchText, found, langCode) => {
        return suggestionsRepo.addSuggestion(searchText, found, langCode);
    });

    registerHandler(SearchChannels.searchText, async (_event, langCode, query, page) => {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const result = await tantivyService.searchSermons(langCode, query, ITEMS_PER_PAGE, offset);

        const hits: TantivySearchHit[] = [];
        for (const hit of result.hits) {
            const sermonIds = refRepo.tantivyDateToSermonIds(hit.tantivySermonDate);
            const sermonId = sermonIds[0];
            if (!sermonId) continue;

            const meta = referenceDataService.getSermonMeta(hit.translationId, langCode, sermonId);
            const snippets = await tantivyService.getMatchingParagraphs(
                langCode,
                query,
                hit.translationId,
                hit.tantivySermonDate,
                5,
            );
            hits.push({
                translationId: hit.translationId,
                sermonId,
                title: meta?.title ?? meta?.enTitle ?? sermonId,
                snippets,
                score: hit.score,
                hitCount: hit.hitCount,
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
