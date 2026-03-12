import { create } from 'zustand';
import type { DocumentViewQuery, SearchMode } from '@shared/types';

interface SearchStateData {
    documentViewQueries: DocumentViewQuery[];
    searchBarOpen: boolean;
    searchBarNavOnly: boolean;
    currentMatchIndex: number;
    totalMatches: number;
    searchMode: SearchMode;
    error: string | null;
    scrollToMatchRequested: boolean;
}

interface SearchStateActions {
    setDocumentViewQueries(
        q: DocumentViewQuery[] | ((prev: DocumentViewQuery[]) => DocumentViewQuery[]),
    ): void;
    openSearchBar(navOnly?: boolean): void;
    closeSearchBar(): void;
    setCurrentMatchIndex(i: number): void;
    setTotalMatches(n: number): void;
    setSearchMode(mode: SearchMode): void;
    nextMatch(): void;
    prevMatch(): void;
    clearSearch(documentTitle: string): void;
    setError(error: string | null): void;
    requestScrollToMatch(): void;
    clearScrollToMatchRequest(): void;
}

type SearchState = SearchStateData & SearchStateActions;

export const useSearchStore = create<SearchState>((set) => ({
    documentViewQueries: [],
    searchBarOpen: false,
    searchBarNavOnly: false,
    currentMatchIndex: 0,
    totalMatches: 0,
    searchMode: 'any',
    error: null,
    scrollToMatchRequested: false,

    setDocumentViewQueries: (q) =>
        set((s) => ({
            documentViewQueries: typeof q === 'function' ? q(s.documentViewQueries) : q,
        })),

    setSearchMode: (mode) => set({ searchMode: mode }),
    openSearchBar: (navOnly) => set({ searchBarOpen: true, searchBarNavOnly: !!navOnly }),
    closeSearchBar: () => set({ searchBarOpen: false, searchBarNavOnly: false }),
    setCurrentMatchIndex: (i) => set({ currentMatchIndex: i }),
    setTotalMatches: (n) => set({ totalMatches: n }),

    nextMatch: () => {
        return set((s) => {
            if (s.totalMatches === 0) {
                return {};
            }
            return {
                currentMatchIndex: (s.currentMatchIndex + 1) % s.totalMatches,
                scrollToMatchRequested: true,
            };
        });
    },

    prevMatch: () => {
        return set((s) => {
            if (s.totalMatches === 0) {
                return {};
            }

            return {
                currentMatchIndex: (s.currentMatchIndex - 1 + s.totalMatches) % s.totalMatches,
                scrollToMatchRequested: true,
            };
        });
    },

    clearSearch: (documentTitle) =>
        set((s) => ({
            documentViewQueries: s.documentViewQueries.filter(
                (q) => q.documentTitle !== documentTitle,
            ),
            currentMatchIndex: 0,
            totalMatches: 0,
            scrollToMatchRequested: false,
        })),

    requestScrollToMatch: () => set({ scrollToMatchRequested: true }),
    clearScrollToMatchRequest: () => set({ scrollToMatchRequested: false }),

    setError: (error) => set({ error }),
}));
