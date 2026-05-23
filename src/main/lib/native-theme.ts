import { nativeTheme } from 'electron';
import {
    DEFAULT_THEME_MODE,
    THEME_BACKGROUND,
    resolveThemeMode,
    type ResolvedTheme,
    type ThemeState,
} from '@shared/theme';
import * as configRepo from '@main/database/repositories/config.repository';
import { getMainWindow } from './window';

const NATIVE_CHROME_THEME: ResolvedTheme = 'dark';

function systemPrefersDark(): boolean {
    return nativeTheme.shouldUseDarkColors;
}

export function getThemeState(): ThemeState {
    const themeMode = configRepo.getThemeMode() ?? DEFAULT_THEME_MODE;
    const resolvedTheme = resolveThemeMode(themeMode, systemPrefersDark);
    return { themeMode, resolvedTheme };
}

export function applyNativeChromeTheme(): void {
    nativeTheme.themeSource = NATIVE_CHROME_THEME;
}

export function applyResolvedTheme(resolvedTheme: ResolvedTheme): void {
    applyNativeChromeTheme();
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
        win.setBackgroundColor(THEME_BACKGROUND[resolvedTheme]);
    }
}
