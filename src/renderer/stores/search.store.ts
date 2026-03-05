import { create } from 'zustand';
import type { DocumentViewQuery } from '@shared/types';

interface SearchState {
    documentViewQueries: DocumentViewQuery[];
    setDocumentViewQueries(
        q: DocumentViewQuery[] | ((prev: DocumentViewQuery[]) => DocumentViewQuery[]),
    ): void;
}

export const useSearchStore = create<SearchState>((set) => ({
    documentViewQueries: [],
    setDocumentViewQueries: (q) =>
        set((s) => ({
            documentViewQueries: typeof q === 'function' ? q(s.documentViewQueries) : q,
        })),
}));
