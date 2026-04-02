import type { CustomDocument } from '@shared/types';
import { createStore } from './create-store';

interface CustomDocumentsState {
    customDocuments: CustomDocument[];
    error: string | null;
    setCustomDocuments(docs: CustomDocument[]): void;
    addCustomDocument(doc: CustomDocument): void;
    removeCustomDocument(id: string): void;
    setError(error: string | null): void;
}

export const useCustomDocumentsStore = createStore<CustomDocumentsState>((set) => ({
    customDocuments: [],
    error: null,
    setCustomDocuments: (docs) => set({ customDocuments: docs }),
    addCustomDocument: (doc) => set((s) => ({ customDocuments: [...s.customDocuments, doc] })),
    removeCustomDocument: (id) =>
        set((s) => ({
            customDocuments: s.customDocuments.filter((d) => d.id !== id),
        })),
    setError: (error) => set({ error }),
}));
