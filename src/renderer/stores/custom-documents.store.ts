import { create } from 'zustand';
import type { CustomDocument } from '@shared/types';

interface CustomDocumentsState {
    customDocuments: CustomDocument[];
    error: string | null;
    setCustomDocuments(docs: CustomDocument[]): void;
    addCustomDocument(doc: CustomDocument): void;
    removeCustomDocument(id: string): void;
    setError(error: string | null): void;
}

export const useCustomDocumentsStore = create<CustomDocumentsState>((set) => ({
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
