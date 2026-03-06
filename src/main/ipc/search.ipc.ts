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
        const offset = page * ITEMS_PER_PAGE;
        const result = await tantivyService.searchSermons(langCode, query, ITEMS_PER_PAGE, offset);

        const hits: TantivySearchHit[] = [];
        for (const hit of result.hits) {
            // Reverse-lookup: Tantivy sermonDate (number) → sermon IDs
            const sermonIds = refRepo.tantivyDateToSermonIds(hit.sermonDate);
            const sermonDate = sermonIds[0] ?? String(hit.sermonDate);
            const meta = referenceDataService.getSermonMeta(
                hit.translationId,
                langCode,
                sermonDate,
            );
            const snippet = await tantivyService.getSearchSnippet(
                langCode,
                query,
                hit.bestDocAddress,
            );
            hits.push({
                translationId: hit.translationId,
                sermonDate: hit.sermonDate,
                title: meta?.title ?? sermonDate,
                snippet,
                score: hit.score,
            });
        }

        return { hits, total: result.total, query };
    });

    registerHandler(
        SearchChannels.searchContent,
        async (_event, langCode, query, translationId) => {
            const result = await tantivyService.searchSermons(langCode, query, 1, 0);
            const hit = result.hits.find((h) => h.translationId === translationId);
            if (!hit) return '';
            return await tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
        },
    );
}
