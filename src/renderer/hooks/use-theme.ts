import { useEffect } from 'react';
import { getAutoTheme, getNextAutoThemeChangeTime } from '@shared/theme';
import { useThemeStore } from '@renderer/stores/theme.store';

export function useThemeSync(): void {
    const themeMode = useThemeStore((s) => s.themeMode);
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const setResolvedTheme = useThemeStore((s) => s.setResolvedTheme);

    useEffect(() => {
        let cancelled = false;
        window.api.app.getThemeState().then((state) => {
            if (cancelled) return;
            if (state.themeMode !== useThemeStore.getState().themeMode) {
                useThemeStore.setState({
                    themeMode: state.themeMode,
                    resolvedTheme: state.resolvedTheme,
                });
            } else if (state.resolvedTheme !== useThemeStore.getState().resolvedTheme) {
                setResolvedTheme(state.resolvedTheme);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [setResolvedTheme]);

    useEffect(() => {
        if (themeMode !== 'system') return;

        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (isDark: boolean) => {
            setResolvedTheme(isDark ? 'dark' : 'light');
            window.api.app.refreshNativeTheme();
        };
        apply(mql.matches);
        const handler = (e: MediaQueryListEvent) => apply(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [themeMode, setResolvedTheme]);

    useEffect(() => {
        if (themeMode !== 'auto') return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const tick = () => {
            setResolvedTheme(getAutoTheme());
            window.api.app.refreshNativeTheme();

            const now = new Date();
            const delay = Math.max(1000, getNextAutoThemeChangeTime(now).getTime() - now.getTime());
            timeoutId = setTimeout(tick, delay);
        };

        tick();
        return () => {
            if (timeoutId !== null) clearTimeout(timeoutId);
        };
    }, [themeMode, setResolvedTheme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);
}
