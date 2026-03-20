import { create } from 'zustand';
import type { BibleVersionInfo, ViewMenuValue } from '@shared/types';
import { DEFAULT_MAX_TABS } from '@shared/constants';

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
    contentLanguage: string | null;
    activeBibleVersion: BibleVersionInfo | null;
    rememberReadingPosition: boolean;
    maxTabs: number;
    error: string | null;
    readingMode: boolean;

    setLoaded(v: boolean): void;
    setSyncing(v: boolean): void;
    setMainView(v: ViewMenuValue): void;
    setOptionView(v: OptionViewValue): void;
    setSidebarHidden(v: boolean): void;
    setContentLanguage(code: string | null): void;
    setActiveBibleVersion(v: BibleVersionInfo | null): void;
    setRememberReadingPosition(value: boolean): void;
    setMaxTabs(value: number): void;
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
    contentLanguage: null,
    activeBibleVersion: null,
    rememberReadingPosition: true,
    maxTabs: DEFAULT_MAX_TABS,
    error: null,
    readingMode: false,

    setLoaded: (v) => set({ loaded: v }),
    setSyncing: (v) => set({ syncing: v }),
    setMainView: (v) => set({ mainView: v }),
    setOptionView: (v) => set({ optionView: v }),
    setSidebarHidden: (v) => set({ sidebarHidden: v }),
    setContentLanguage: (code) => set({ contentLanguage: code }),
    setActiveBibleVersion: (v) => set({ activeBibleVersion: v }),
    setRememberReadingPosition: (value) => set({ rememberReadingPosition: value }),
    setMaxTabs: (value) => set({ maxTabs: value }),
    setError: (error) => set({ error }),
    showOptions: (option) => set({ mainView: 'options', optionView: option }),
    toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
    setReadingMode: (v) => set({ readingMode: v }),
    toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),
}));
