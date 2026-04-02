import { DEFAULT_SEARCH_MODE } from '@shared/constants';
import type { DocumentViewQuery, SearchMode } from '@shared/types';
import { createStore } from './create-store';

type SearchUiState = {
    searchBarOpen: boolean;
    searchBarNavOnly: boolean;
    currentMatchIndex: number;
    currentParagraphIndex: number | null;
    totalMatches: number;
    requestedMatchIndex: number | null;
    requestedParagraphIndex: number | null;
};

interface SearchStateData {
    documentViewQueries: Record<string, DocumentViewQuery>;
    searchUiByTab: Record<string, SearchUiState>;
    searchMode: SearchMode;
    error: string | null;
}

interface SearchStateActions {
    setDocumentViewQuery(tabKey: string, query: DocumentViewQuery | null): void;
    getDocumentViewQuery(tabKey: string | null): DocumentViewQuery | null;
    openSearchBar(tabKey: string, navOnly?: boolean): void;
    closeSearchBar(tabKey: string): void;
    setCurrentMatchIndex(tabKey: string, index: number): void;
    setCurrentParagraphIndex(tabKey: string, index: number | null): void;
    setTotalMatches(tabKey: string, total: number): void;
    setSearchMode(mode: SearchMode): void;
    nextMatch(tabKey: string): void;
    prevMatch(tabKey: string): void;
    clearSearch(tabKey: string): void;
    cleanupTabs(removedKeys: string[]): void;
    setError(error: string | null): void;
    requestScrollToMatch(tabKey: string, matchIndex?: number, paragraphIndex?: number): void;
    clearScrollToMatchRequest(tabKey: string): void;
}

type SearchState = SearchStateData & SearchStateActions;

const defaultUiState = (): SearchUiState => ({
    searchBarOpen: false,
    searchBarNavOnly: false,
    currentMatchIndex: 0,
    currentParagraphIndex: null,
    totalMatches: 0,
    requestedMatchIndex: null,
    requestedParagraphIndex: null,
});

function getUiState(state: SearchStateData, tabKey: string): SearchUiState {
    return state.searchUiByTab[tabKey] ?? defaultUiState();
}

function removeTabEntry<T>(record: Record<string, T>, tabKey: string): Record<string, T> {
    const next = { ...record };
    delete next[tabKey];
    return next;
}

function updateTabUiState(
    state: SearchStateData,
    tabKey: string,
    patch: Partial<SearchUiState> | ((current: SearchUiState) => SearchUiState),
): Record<string, SearchUiState> {
    const current = getUiState(state, tabKey);
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    return {
        ...state.searchUiByTab,
        [tabKey]: next,
    };
}

export const useSearchStore = createStore<SearchState>((set, get) => ({
    documentViewQueries: {},
    searchUiByTab: {},
    searchMode: DEFAULT_SEARCH_MODE,
    error: null,

    setDocumentViewQuery: (tabKey, query) =>
        set((state) => {
            if (!query) {
                return { documentViewQueries: removeTabEntry(state.documentViewQueries, tabKey) };
            }

            return {
                documentViewQueries: {
                    ...state.documentViewQueries,
                    [tabKey]: query,
                },
            };
        }),

    getDocumentViewQuery: (tabKey) => (tabKey ? (get().documentViewQueries[tabKey] ?? null) : null),

    setSearchMode: (mode) => set({ searchMode: mode }),

    openSearchBar: (tabKey, navOnly) =>
        set((state) => ({
            searchUiByTab: updateTabUiState(state, tabKey, {
                searchBarOpen: true,
                searchBarNavOnly: !!navOnly,
            }),
        })),

    closeSearchBar: (tabKey) =>
        set((state) => {
            return {
                documentViewQueries: removeTabEntry(state.documentViewQueries, tabKey),
                searchUiByTab: updateTabUiState(state, tabKey, defaultUiState()),
            };
        }),

    setCurrentMatchIndex: (tabKey, index) =>
        set((state) => ({
            searchUiByTab: updateTabUiState(state, tabKey, { currentMatchIndex: index }),
        })),

    setCurrentParagraphIndex: (tabKey, index) =>
        set((state) => ({
            searchUiByTab: updateTabUiState(state, tabKey, { currentParagraphIndex: index }),
        })),

    setTotalMatches: (tabKey, total) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            const nextMatchIndex =
                total > 0
                    ? Math.min(current.requestedMatchIndex ?? current.currentMatchIndex, total - 1)
                    : 0;
            return {
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: {
                        ...current,
                        totalMatches: total,
                        currentMatchIndex: nextMatchIndex,
                    },
                },
            };
        }),

    nextMatch: (tabKey) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            if (current.totalMatches === 0) return {};

            const nextIndex = (current.currentMatchIndex + 1) % current.totalMatches;
            return {
                searchUiByTab: updateTabUiState(state, tabKey, {
                    currentMatchIndex: nextIndex,
                    requestedMatchIndex: nextIndex,
                }),
            };
        }),

    prevMatch: (tabKey) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            if (current.totalMatches === 0) return {};

            const nextIndex =
                (current.currentMatchIndex - 1 + current.totalMatches) % current.totalMatches;
            return {
                searchUiByTab: updateTabUiState(state, tabKey, {
                    currentMatchIndex: nextIndex,
                    requestedMatchIndex: nextIndex,
                }),
            };
        }),

    clearSearch: (tabKey) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            return {
                documentViewQueries: removeTabEntry(state.documentViewQueries, tabKey),
                searchUiByTab: updateTabUiState(state, tabKey, {
                    ...current,
                    currentMatchIndex: 0,
                    currentParagraphIndex: null,
                    totalMatches: 0,
                    requestedMatchIndex: null,
                    requestedParagraphIndex: null,
                }),
            };
        }),

    cleanupTabs: (removedKeys) =>
        set((state) => {
            const queries = { ...state.documentViewQueries };
            const ui = { ...state.searchUiByTab };
            for (const key of removedKeys) {
                delete queries[key];
                delete ui[key];
            }
            return { documentViewQueries: queries, searchUiByTab: ui };
        }),

    requestScrollToMatch: (tabKey, matchIndex, paragraphIndex) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            return {
                searchUiByTab: updateTabUiState(state, tabKey, {
                    ...current,
                    currentParagraphIndex: paragraphIndex ?? current.currentParagraphIndex,
                    requestedMatchIndex: matchIndex ?? null,
                    requestedParagraphIndex: paragraphIndex ?? null,
                }),
            };
        }),

    clearScrollToMatchRequest: (tabKey) =>
        set((state) => ({
            searchUiByTab: updateTabUiState(state, tabKey, {
                requestedMatchIndex: null,
                requestedParagraphIndex: null,
            }),
        })),

    setError: (error) => set({ error }),
}));
