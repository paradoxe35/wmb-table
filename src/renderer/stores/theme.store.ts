import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UiLanguagePreference } from '@shared/constants';

type ThemeMode = 'system' | 'light' | 'dark';

export type FontSizeOption = 'small' | 'default' | 'large' | 'x-large';

export const FONT_SIZE_MAP: Record<FontSizeOption, number> = {
    small: 12,
    default: 14,
    large: 16,
    'x-large': 18,
};

interface ThemeState {
    themeMode: ThemeMode;
    resolvedTheme: 'light' | 'dark';
    fontSizeOption: FontSizeOption;
    uiLanguagePreference: UiLanguagePreference;

    setThemeMode(mode: ThemeMode): void;
    setResolvedTheme(theme: 'light' | 'dark'): void;
    setFontSizeOption(option: FontSizeOption): void;
    setUiLanguagePreference(pref: UiLanguagePreference): void;
}

function getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'system') return getSystemTheme();
    return mode;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            themeMode: 'light',
            resolvedTheme: 'light',
            fontSizeOption: 'default' as FontSizeOption,
            uiLanguagePreference: 'auto' as UiLanguagePreference,

            setThemeMode: (mode) => set({ themeMode: mode, resolvedTheme: resolveTheme(mode) }),
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
                    state.resolvedTheme = resolveTheme(state.themeMode);
                    state.uiLanguagePreference = state.uiLanguagePreference ?? 'auto';
                }
            },
        },
    ),
);
