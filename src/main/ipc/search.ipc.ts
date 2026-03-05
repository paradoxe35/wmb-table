import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';
import * as tantivyService from '@main/services/tantivy.service';
import * as referenceDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';
import type { TantivySearchHit } from '@shared/types';

const ITEMS_PER_PAGE = 20;

export function registerSearchHandlers(): void {
    registerHandler(SearchChannels.getSuggestions, async () => {
        return suggestionsRepo.getSuggestions();
    });

    registerHandler(SearchChannels.addSuggestion, async (_event, searchText, found) => {
        return suggestionsRepo.addSuggestion(searchText, found);
    });

    registerHandler(SearchChannels.searchText, async (_event, langCode, query, page) => {
        const offset = page * ITEMS_PER_PAGE;
        const result = tantivyService.searchSermons(langCode, query, ITEMS_PER_PAGE, offset);

        const hits: TantivySearchHit[] = result.hits.map((hit) => {
            // Reverse-lookup: Tantivy sermonDate (number) → sermon IDs
            const sermonIds = refRepo.tantivyDateToSermonIds(hit.sermonDate);
            const sermonDate = sermonIds[0] ?? String(hit.sermonDate);
            const meta = referenceDataService.getSermonMeta(
                hit.translationId,
                langCode,
                sermonDate,
            );
            const snippet = tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
            return {
                translationId: hit.translationId,
                sermonDate: hit.sermonDate,
                title: meta?.title ?? sermonDate,
                snippet,
                score: hit.score,
            };
        });

        return { hits, total: result.total, query };
    });

    registerHandler(
        SearchChannels.searchContent,
        async (_event, langCode, query, translationId) => {
            const result = tantivyService.searchSermons(langCode, query, 1, 0);
            const hit = result.hits.find((h) => h.translationId === translationId);
            if (!hit) return '';
            return tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
        },
    );
}
