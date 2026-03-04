import { SearchChannels } from '@shared/ipc.types';
import { registerHandler } from './register';

export function registerSearchHandlers(): void {
  registerHandler(SearchChannels.getSuggestions, async () => {
    throw new Error('Not implemented: search:getSuggestions');
  });

  registerHandler(SearchChannels.addSuggestion, async () => {
    throw new Error('Not implemented: search:addSuggestion');
  });

  registerHandler(SearchChannels.searchText, async () => {
    throw new Error('Not implemented: search:searchText');
  });

  registerHandler(SearchChannels.searchContent, async () => {
    throw new Error('Not implemented: search:searchContent');
  });
}
