export type ResolvedTheme = 'light' | 'dark';

export type ThemeMode = 'auto' | 'system' | 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export interface ThemeState {
    themeMode: ThemeMode;
    resolvedTheme: ResolvedTheme;
}

/** Dark in both themes to match the native chrome; also the window background,
 * a sliver of which shows under the Windows menu bar (electron/electron#45199) */
export const HEADER_BACKGROUND: Record<ResolvedTheme, string> = {
    light: '#001529',
    dark: '#141414',
};

export function getAutoTheme(date: Date = new Date()): ResolvedTheme {
    const hour = date.getHours();
    return hour >= 7 && hour < 18 ? 'light' : 'dark';
}

export function getNextAutoThemeChangeTime(from: Date = new Date()): Date {
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

/**
 * Resolve a `ThemeMode` to a concrete `ResolvedTheme`.
 *
 * `system` resolution must be supplied by the caller (renderer uses
 * `matchMedia`, main uses `nativeTheme.shouldUseDarkColors`) since neither API
 * is available in both processes.
 */
export function resolveThemeMode(mode: ThemeMode, systemPrefersDark: () => boolean): ResolvedTheme {
    if (mode === 'auto') return getAutoTheme();
    if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return mode;
}
