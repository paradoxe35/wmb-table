import { create } from 'zustand';
import type { DocumentViewQuery, SearchMode } from '@shared/types';

type SearchUiState = {
    searchBarOpen: boolean;
    searchBarNavOnly: boolean;
    currentMatchIndex: number;
    totalMatches: number;
    requestedMatchIndex: number | null;
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
    setTotalMatches(tabKey: string, total: number): void;
    setSearchMode(mode: SearchMode): void;
    nextMatch(tabKey: string): void;
    prevMatch(tabKey: string): void;
    clearSearch(tabKey: string): void;
    setError(error: string | null): void;
    requestScrollToMatch(tabKey: string, matchIndex?: number): void;
    clearScrollToMatchRequest(tabKey: string): void;
}

type SearchState = SearchStateData & SearchStateActions;

const defaultUiState = (): SearchUiState => ({
    searchBarOpen: false,
    searchBarNavOnly: false,
    currentMatchIndex: 0,
    totalMatches: 0,
    requestedMatchIndex: null,
});

function getUiState(state: SearchStateData, tabKey: string): SearchUiState {
    return state.searchUiByTab[tabKey] ?? defaultUiState();
}

export const useSearchStore = create<SearchState>((set, get) => ({
    documentViewQueries: {},
    searchUiByTab: {},
    searchMode: 'any',
    error: null,

    setDocumentViewQuery: (tabKey, query) =>
        set((state) => {
            if (!query) {
                const { [tabKey]: _removed, ...rest } = state.documentViewQueries;
                return { documentViewQueries: rest };
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
            searchUiByTab: {
                ...state.searchUiByTab,
                [tabKey]: {
                    ...getUiState(state, tabKey),
                    searchBarOpen: true,
                    searchBarNavOnly: !!navOnly,
                },
            },
        })),

    closeSearchBar: (tabKey) =>
        set((state) => ({
            searchUiByTab: {
                ...state.searchUiByTab,
                [tabKey]: {
                    ...getUiState(state, tabKey),
                    searchBarOpen: false,
                    searchBarNavOnly: false,
                },
            },
        })),

    setCurrentMatchIndex: (tabKey, index) =>
        set((state) => ({
            searchUiByTab: {
                ...state.searchUiByTab,
                [tabKey]: {
                    ...getUiState(state, tabKey),
                    currentMatchIndex: index,
                },
            },
        })),

    setTotalMatches: (tabKey, total) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            return {
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: {
                        ...current,
                        totalMatches: total,
                        currentMatchIndex:
                            total > 0 ? Math.min(current.currentMatchIndex, total - 1) : 0,
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
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: {
                        ...current,
                        currentMatchIndex: nextIndex,
                        requestedMatchIndex: nextIndex,
                    },
                },
            };
        }),

    prevMatch: (tabKey) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            if (current.totalMatches === 0) return {};

            const nextIndex =
                (current.currentMatchIndex - 1 + current.totalMatches) % current.totalMatches;
            return {
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: {
                        ...current,
                        currentMatchIndex: nextIndex,
                        requestedMatchIndex: nextIndex,
                    },
                },
            };
        }),

    clearSearch: (tabKey) =>
        set((state) => {
            const { [tabKey]: _removedQuery, ...remainingQueries } = state.documentViewQueries;
            return {
                documentViewQueries: remainingQueries,
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: defaultUiState(),
                },
            };
        }),

    requestScrollToMatch: (tabKey, matchIndex) =>
        set((state) => {
            const current = getUiState(state, tabKey);
            return {
                searchUiByTab: {
                    ...state.searchUiByTab,
                    [tabKey]: {
                        ...current,
                        currentMatchIndex: matchIndex ?? current.currentMatchIndex,
                        requestedMatchIndex: matchIndex ?? current.currentMatchIndex,
                    },
                },
            };
        }),

    clearScrollToMatchRequest: (tabKey) =>
        set((state) => ({
            searchUiByTab: {
                ...state.searchUiByTab,
                [tabKey]: {
                    ...getUiState(state, tabKey),
                    requestedMatchIndex: null,
                },
            },
        })),

    setError: (error) => set({ error }),
}));
