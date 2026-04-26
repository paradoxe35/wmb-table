import { persist } from 'zustand/middleware';
import type { UiLanguagePreference } from '@shared/constants';
import { createStore } from './create-store';

export type ThemeMode = 'auto' | 'system' | 'light' | 'dark';

export type FontSizeOption = 'small' | 'default' | 'large' | 'x-large';

export const FONT_SIZE_MAP: Record<FontSizeOption, number> = {
    small: 14,
    default: 16,
    large: 18,
    'x-large': 20,
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

export function getAutoTheme(date = new Date()): 'light' | 'dark' {
    const hour = date.getHours();
    return hour >= 7 && hour < 18 ? 'light' : 'dark';
}

export function getNextAutoThemeChangeTime(from = new Date()): Date {
    const next = new Date(from);
    const hour = from.getHours();

    if (hour < 7) {
        next.setHours(7, 0, 0, 0);
        return next;
    }

    if (hour < 18) {
        next.setHours(18, 0, 0, 0);
        return next;
    }

    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    return next;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'auto') return getAutoTheme();
    if (mode === 'system') return getSystemTheme();
    return mode;
}

export const useThemeStore = createStore<ThemeState>()(
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
