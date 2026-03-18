import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

import { DEFAULT_UI_LANGUAGE, type UiLanguage } from '@shared/constants';

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
    uiLanguage: UiLanguage;

    setThemeMode(mode: ThemeMode): void;
    setResolvedTheme(theme: 'light' | 'dark'): void;
    setFontSizeOption(option: FontSizeOption): void;
    setUiLanguage(lang: UiLanguage): void;
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
            uiLanguage: DEFAULT_UI_LANGUAGE,

            setThemeMode: (mode) => set({ themeMode: mode, resolvedTheme: resolveTheme(mode) }),
            setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
            setFontSizeOption: (option) => set({ fontSizeOption: option }),
            setUiLanguage: (lang) => set({ uiLanguage: lang }),
        }),
        {
            name: 'wmb-theme',
            partialize: (state) => ({
                themeMode: state.themeMode,
                fontSizeOption: state.fontSizeOption,
                uiLanguage: state.uiLanguage,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.resolvedTheme = resolveTheme(state.themeMode);
                }
            },
        },
    ),
);
