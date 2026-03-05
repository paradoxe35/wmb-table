import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';
import * as sermonMetadataRepo from '@main/database/repositories/sermon-metadata.repository';
import * as tantivyService from '@main/services/tantivy.service';
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
            const meta = sermonMetadataRepo.getSermonMeta(hit.translationId, langCode);
            const snippet = tantivyService.getSearchSnippet(langCode, query, hit.bestDocAddress);
            return {
                translationId: hit.translationId,
                sermonDate: hit.sermonDate,
                title: meta?.title ?? String(hit.sermonDate),
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
