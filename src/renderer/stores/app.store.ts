import { create } from 'zustand';
import type { ViewMenuValue } from '@shared/types';

type OptionViewValue =
    | 'search'
    | 'subject'
    | 'history'
    | 'editor'
    | 'highlights'
    | 'bible'
    | 'settings'
    | 'ai-chat';

interface AppState {
    loaded: boolean;
    syncing: boolean;
    mainView: ViewMenuValue;
    optionView: OptionViewValue;
    sidebarHidden: boolean;
    activeLanguage: string | null;
    rememberReadingPosition: boolean;
    error: string | null;
    readingMode: boolean;

    setLoaded(v: boolean): void;
    setSyncing(v: boolean): void;
    setMainView(v: ViewMenuValue): void;
    setOptionView(v: OptionViewValue): void;
    setSidebarHidden(v: boolean): void;
    setActiveLanguage(code: string | null): void;
    setRememberReadingPosition(value: boolean): void;
    setError(error: string | null): void;
    showOptions(option: OptionViewValue): void;
    toggleSidebar(): void;
    setReadingMode(v: boolean): void;
    toggleReadingMode(): void;
}

export const useAppStore = create<AppState>((set) => ({
    loaded: false,
    syncing: false,
    mainView: 'document',
    optionView: 'search',
    sidebarHidden: false,
    activeLanguage: null,
    rememberReadingPosition: true,
    error: null,
    readingMode: false,

    setLoaded: (v) => set({ loaded: v }),
    setSyncing: (v) => set({ syncing: v }),
    setMainView: (v) => set({ mainView: v }),
    setOptionView: (v) => set({ optionView: v }),
    setSidebarHidden: (v) => set({ sidebarHidden: v }),
    setActiveLanguage: (code) => set({ activeLanguage: code }),
    setRememberReadingPosition: (value) => set({ rememberReadingPosition: value }),
    setError: (error) => set({ error }),
    showOptions: (option) => set({ mainView: 'options', optionView: option }),
    toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
    setReadingMode: (v) => set({ readingMode: v }),
    toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),
}));
