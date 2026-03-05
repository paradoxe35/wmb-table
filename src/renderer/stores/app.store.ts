import { create } from 'zustand';
import type { ViewMenuValue } from '@shared/types';

type OptionViewValue = 'search' | 'subject' | 'history' | 'editor' | 'bible';

interface AppState {
    loaded: boolean;
    needsSetup: boolean;
    mainView: ViewMenuValue;
    optionView: OptionViewValue;
    sidebarHidden: boolean;
    activeLanguage: string;

    setLoaded(v: boolean): void;
    setNeedsSetup(v: boolean): void;
    setMainView(v: ViewMenuValue): void;
    setOptionView(v: OptionViewValue): void;
    setSidebarHidden(v: boolean): void;
    setActiveLanguage(code: string): void;
    showOptions(option: OptionViewValue): void;
    toggleSidebar(): void;
}

export const useAppStore = create<AppState>((set) => ({
    loaded: false,
    needsSetup: false,
    mainView: 'document',
    optionView: 'search',
    sidebarHidden: true,
    activeLanguage: 'en',

    setLoaded: (v) => set({ loaded: v }),
    setNeedsSetup: (v) => set({ needsSetup: v }),
    setMainView: (v) => set({ mainView: v }),
    setOptionView: (v) => set({ optionView: v }),
    setSidebarHidden: (v) => set({ sidebarHidden: v }),
    setActiveLanguage: (code) => set({ activeLanguage: code }),
    showOptions: (option) => set({ mainView: 'options', optionView: option }),
    toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
}));
