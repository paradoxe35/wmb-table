import { useEffect, useMemo } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import type { Locale } from 'antd/es/locale';
import { resolveUiLanguage, type UiLanguage } from '@shared/constants';
import { useAppStore } from './stores';
import frFR from 'antd/locale/fr_FR';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';

import { useTranslation } from 'react-i18next';
import { useInitApp } from './hooks/index';
import { useTtsSetup } from './hooks/use-tts-setup';
import { useThemeSync } from './hooks/use-theme';
import { useThemeStore, FONT_SIZE_MAP } from './stores/theme.store';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';
import { ErrorBoundary } from './components/error-boundary';

const ANTD_LOCALES: Record<UiLanguage, Locale> = {
    fr: frFR,
    en: enUS,
    es: esES,
};

function useAntdLocale(): Locale {
    const uiLanguagePreference = useThemeStore((s) => s.uiLanguagePreference);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const { i18n } = useTranslation();

    // Resolve effective UI language from preference + content language
    const uiLanguage = useMemo(
        () => resolveUiLanguage(uiLanguagePreference, contentLanguage),
        [uiLanguagePreference, contentLanguage],
    );

    // Sync i18next and backend
    useEffect(() => {
        if (i18n.language !== uiLanguage) {
            i18n.changeLanguage(uiLanguage);
        }
        window.api.app.setUiLanguage(uiLanguagePreference);
    }, [uiLanguage, uiLanguagePreference, i18n]);

    return useMemo(
        (): Locale => ANTD_LOCALES[uiLanguage] ?? ANTD_LOCALES[resolveUiLanguage(null, null)],
        [uiLanguage],
    );
}

export default function App() {
    useInitApp();
    useTtsSetup();
    useThemeSync();
    const antdLocale = useAntdLocale();
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const fontSizeOption = useThemeStore((s) => s.fontSizeOption);

    const appTheme = useMemo(() => {
        const isDark = resolvedTheme === 'dark';
        return {
            algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            cssVar: { prefix: 'ant' },
            token: {
                colorPrimary: '#1990ff',
                fontSize: FONT_SIZE_MAP[fontSizeOption],
            },
            components: {
                Layout: {
                    headerBg: isDark ? '#141414' : '#001529',
                    headerPadding: '0',
                    siderBg: isDark ? '#1f1f1f' : '#ffffff',
                },
                Menu: {
                    darkItemBg: isDark ? '#141414' : '#001529',
                    darkItemSelectedBg: '#1990ff',
                },
            },
        };
    }, [resolvedTheme, fontSizeOption]);

    return (
        <ErrorBoundary>
            <ConfigProvider locale={antdLocale} theme={appTheme}>
                <AntApp>
                    <AppLayout>
                        <ContentApp />
                    </AppLayout>
                </AntApp>
            </ConfigProvider>
        </ErrorBoundary>
    );
}
