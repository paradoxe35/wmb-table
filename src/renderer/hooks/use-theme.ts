import { useEffect } from 'react';
import {
    getAutoTheme,
    getNextAutoThemeChangeTime,
    useThemeStore,
} from '@renderer/stores/theme.store';

/**
 * Listens for system and auto theme changes and keeps the resolved theme in sync.
 * Also sets `data-theme` attribute on <html> for CSS targeting.
 */
export function useThemeSync(): void {
    const themeMode = useThemeStore((s) => s.themeMode);
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const setResolvedTheme = useThemeStore((s) => s.setResolvedTheme);

    // Listen for system theme changes
    useEffect(() => {
        if (themeMode !== 'system') return;

        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        setResolvedTheme(mql.matches ? 'dark' : 'light');
        const handler = (e: MediaQueryListEvent) => {
            setResolvedTheme(e.matches ? 'dark' : 'light');
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [themeMode, setResolvedTheme]);

    useEffect(() => {
        if (themeMode !== 'auto') {
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNextChange = () => {
            setResolvedTheme(getAutoTheme());

            const now = new Date();
            const nextChangeAt = getNextAutoThemeChangeTime(now);
            const delay = Math.max(1000, nextChangeAt.getTime() - now.getTime());

            timeoutId = setTimeout(scheduleNextChange, delay);
        };

        scheduleNextChange();

        return () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        };
    }, [themeMode, setResolvedTheme]);

    // Set data-theme attribute on <html>
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);
}
