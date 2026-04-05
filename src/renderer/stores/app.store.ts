import type { BibleVersionInfo, ViewMenuValue } from '@shared/types';
import { DEFAULT_MAX_TABS } from '@shared/constants';
import { createStore } from './create-store';

type OptionViewValue =
    | 'search'
    | 'subject'
    | 'history'
    | 'editor'
    | 'highlights'
    | 'bible'
    | 'settings'
    | 'ai-chat';

export const SETTINGS_TAB_KEYS = {
    general: 'general',
    documentView: 'documentView',
    languages: 'languages',
    tts: 'tts',
    ai: 'ai',
    backup: 'backup',
    update: 'update',
} as const;

export type SettingsTabValue = (typeof SETTINGS_TAB_KEYS)[keyof typeof SETTINGS_TAB_KEYS];

interface AppState {
    loaded: boolean;
    syncing: boolean;
    mainView: ViewMenuValue;
    optionView: OptionViewValue;
    settingsTab: SettingsTabValue;
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
    setSettingsTab(v: SettingsTabValue): void;
    setSidebarHidden(v: boolean): void;
    setContentLanguage(code: string | null): void;
    setActiveBibleVersion(v: BibleVersionInfo | null): void;
    setRememberReadingPosition(value: boolean): void;
    setMaxTabs(value: number): void;
    setError(error: string | null): void;
    showOptions(option: OptionViewValue): void;
    openSettingsTab(tab: SettingsTabValue): void;
    toggleSidebar(): void;
    setReadingMode(v: boolean): void;
    toggleReadingMode(): void;
}

export const useAppStore = createStore<AppState>((set) => ({
    loaded: false,
    syncing: false,
    mainView: 'document',
    optionView: 'search',
    settingsTab: SETTINGS_TAB_KEYS.general,
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
    setSettingsTab: (v) => set({ settingsTab: v }),
    setSidebarHidden: (v) => set({ sidebarHidden: v }),
    setContentLanguage: (code) => set({ contentLanguage: code }),
    setActiveBibleVersion: (v) => set({ activeBibleVersion: v }),
    setRememberReadingPosition: (value) => set({ rememberReadingPosition: value }),
    setMaxTabs: (value) => set({ maxTabs: value }),
    setError: (error) => set({ error }),
    showOptions: (option) => set({ mainView: 'options', optionView: option }),
    openSettingsTab: (tab) =>
        set({ mainView: 'options', optionView: 'settings', settingsTab: tab }),
    toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
    setReadingMode: (v) => set({ readingMode: v }),
    toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),
}));
