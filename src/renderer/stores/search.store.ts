import { create } from 'zustand';
import type { DocumentViewQuery, SearchMode } from '@shared/types';

interface SearchState {
    documentViewQueries: DocumentViewQuery[];
    searchBarOpen: boolean;
    searchBarNavOnly: boolean;
    currentMatchIndex: number;
    totalMatches: number;
    searchMode: SearchMode;

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
}

export const useSearchStore = create<SearchState>((set) => ({
    documentViewQueries: [],
    searchBarOpen: false,
    searchBarNavOnly: false,
    currentMatchIndex: 0,
    totalMatches: 0,
    searchMode: 'any',

    setDocumentViewQueries: (q) =>
        set((s) => ({
            documentViewQueries: typeof q === 'function' ? q(s.documentViewQueries) : q,
        })),

    setSearchMode: (mode) => set({ searchMode: mode }),
    openSearchBar: (navOnly) => set({ searchBarOpen: true, searchBarNavOnly: !!navOnly }),
    closeSearchBar: () => set({ searchBarOpen: false, searchBarNavOnly: false }),
    setCurrentMatchIndex: (i) => set({ currentMatchIndex: i }),
    setTotalMatches: (n) => set({ totalMatches: n }),

    nextMatch: () =>
        set((s) =>
            s.totalMatches === 0
                ? {}
                : { currentMatchIndex: (s.currentMatchIndex + 1) % s.totalMatches },
        ),

    prevMatch: () =>
        set((s) =>
            s.totalMatches === 0
                ? {}
                : {
                      currentMatchIndex:
                          (s.currentMatchIndex - 1 + s.totalMatches) % s.totalMatches,
                  },
        ),

    clearSearch: (documentTitle) =>
        set((s) => ({
            documentViewQueries: s.documentViewQueries.filter(
                (q) => q.documentTitle !== documentTitle,
            ),
            currentMatchIndex: 0,
            totalMatches: 0,
        })),
}));
