import { create } from 'zustand';
import type { DocumentViewQuery } from '@shared/types';

interface SearchState {
    documentViewQueries: DocumentViewQuery[];
    searchBarOpen: boolean;
    currentMatchIndex: number;
    totalMatches: number;

    setDocumentViewQueries(
        q: DocumentViewQuery[] | ((prev: DocumentViewQuery[]) => DocumentViewQuery[]),
    ): void;
    openSearchBar(): void;
    closeSearchBar(): void;
    setCurrentMatchIndex(i: number): void;
    setTotalMatches(n: number): void;
    nextMatch(): void;
    prevMatch(): void;
    clearSearch(documentTitle: string): void;
}

export const useSearchStore = create<SearchState>((set) => ({
    documentViewQueries: [],
    searchBarOpen: false,
    currentMatchIndex: 0,
    totalMatches: 0,

    setDocumentViewQueries: (q) =>
        set((s) => ({
            documentViewQueries: typeof q === 'function' ? q(s.documentViewQueries) : q,
        })),

    openSearchBar: () => set({ searchBarOpen: true }),
    closeSearchBar: () => set({ searchBarOpen: false }),
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
