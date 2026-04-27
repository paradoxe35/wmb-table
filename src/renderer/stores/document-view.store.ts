import { persist } from 'zustand/middleware';
import { createStore } from './create-store';

interface DocumentViewState {
    zoom: number;
    setZoom(value: number): void;
}

export const useDocumentViewStore = createStore<DocumentViewState>()(
    persist(
        (set) => ({
            zoom: 100,
            setZoom: (zoom) => set({ zoom }),
        }),
        {
            name: 'wmb-document-view',
            partialize: (state) => ({
                zoom: state.zoom,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.zoom = Math.max(50, Math.min(200, state.zoom ?? 100));
                }
            },
        },
    ),
);
