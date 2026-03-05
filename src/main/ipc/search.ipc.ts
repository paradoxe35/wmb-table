import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';

export function registerSearchHandlers(): void {
    registerHandler(SearchChannels.getSuggestions, async () => {
        return suggestionsRepo.getSuggestions();
    });

    registerHandler(SearchChannels.addSuggestion, async (_event, searchText, found) => {
        return suggestionsRepo.addSuggestion(searchText, found);
    });

    registerHandler(SearchChannels.searchText, async () => {
        throw new Error('Not implemented: search:searchText');
    });

    registerHandler(SearchChannels.searchContent, async () => {
        throw new Error('Not implemented: search:searchContent');
    });
}
