import { persist } from 'zustand/middleware';
import type { UiLanguagePreference } from '@shared/constants';
import {
    DEFAULT_THEME_MODE,
    resolveThemeMode,
    type ResolvedTheme,
    type ThemeMode,
} from '@shared/theme';
import { createStore } from './create-store';

export type { ThemeMode };

export type FontSizeOption = 'small' | 'default' | 'large' | 'x-large';

export const FONT_SIZE_MAP: Record<FontSizeOption, number> = {
    small: 14,
    default: 16,
    large: 18,
    'x-large': 20,
};

interface ThemeStoreState {
    themeMode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    fontSizeOption: FontSizeOption;
    uiLanguagePreference: UiLanguagePreference;

    setThemeMode(mode: ThemeMode): Promise<void>;
    setResolvedTheme(theme: ResolvedTheme): void;
    setFontSizeOption(option: FontSizeOption): void;
    setUiLanguagePreference(pref: UiLanguagePreference): void;
}

function systemPrefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveLocally(mode: ThemeMode): ResolvedTheme {
    return resolveThemeMode(mode, systemPrefersDark);
}

export const useThemeStore = createStore<ThemeStoreState>()(
    persist(
        (set) => ({
            themeMode: DEFAULT_THEME_MODE,
            resolvedTheme: 'light',
            fontSizeOption: 'default' as FontSizeOption,
            uiLanguagePreference: 'auto' as UiLanguagePreference,

            setThemeMode: async (mode) => {
                set({ themeMode: mode, resolvedTheme: resolveLocally(mode) });
                const next = await window.api.app.setThemeMode(mode);
                set({ themeMode: next.themeMode, resolvedTheme: next.resolvedTheme });
            },
            setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
            setFontSizeOption: (option) => set({ fontSizeOption: option }),
            setUiLanguagePreference: (pref) => set({ uiLanguagePreference: pref }),
        }),
        {
            name: 'wmb-theme',
            partialize: (state) => ({
                themeMode: state.themeMode,
                fontSizeOption: state.fontSizeOption,
                uiLanguagePreference: state.uiLanguagePreference,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.resolvedTheme = resolveLocally(state.themeMode);
                    state.uiLanguagePreference = state.uiLanguagePreference ?? 'auto';
                }
            },
        },
    ),
);
