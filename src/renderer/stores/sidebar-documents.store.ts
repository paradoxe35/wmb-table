import { createStore } from './create-store';

export type SidebarPanelTab = 0 | 1 | 2;
export type SermonFilterMode = 'search' | 'years' | 'alphabet';

const ALPHA_FIRST = 'A';

interface SidebarDocumentsState {
    panelTab: SidebarPanelTab;
    sermonFilter: SermonFilterMode;
    sermonSearchQuery: string;
    sermonSelectedYear: string | null;
    sermonAlphabet: string;

    setPanelTab(i: SidebarPanelTab): void;
    setSermonFilter(m: SermonFilterMode): void;
    setSermonSearchQuery(q: string): void;
    setSermonSelectedYear(y: string | null): void;
    setSermonAlphabet(a: string): void;
}

export const useSidebarDocumentsStore = createStore<SidebarDocumentsState>((set) => ({
    panelTab: 0,
    sermonFilter: 'search',
    sermonSearchQuery: '',
    sermonSelectedYear: null,
    sermonAlphabet: ALPHA_FIRST,

    setPanelTab: (panelTab) => set({ panelTab }),
    setSermonFilter: (sermonFilter) => set({ sermonFilter }),
    setSermonSearchQuery: (sermonSearchQuery) => set({ sermonSearchQuery }),
    setSermonSelectedYear: (sermonSelectedYear) => set({ sermonSelectedYear }),
    setSermonAlphabet: (sermonAlphabet) => set({ sermonAlphabet }),
}));
