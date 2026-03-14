import { useEffect, useMemo } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import type { Locale } from 'antd/es/locale';
import frFR from 'antd/locale/fr_FR';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import { useTranslation } from 'react-i18next';
import { useInitApp } from './hooks/index';
import { useTtsSetup } from './hooks/use-tts-setup';
import { useThemeSync } from './hooks/use-theme';
import { useAppStore } from './stores';
import { useThemeStore } from './stores/theme.store';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';
import { ErrorBoundary } from './components/error-boundary';

function useAntdLocale(): Locale {
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const { i18n } = useTranslation();

    // Sync i18next language on startup (DB load) and on every language switch
    useEffect(() => {
        if (activeLanguage && i18n.language !== activeLanguage) {
            i18n.changeLanguage(activeLanguage);
            window.api.app.setUiLanguage(activeLanguage);
        }
    }, [activeLanguage, i18n]);

    return useMemo((): Locale => {
        if (activeLanguage === 'en') return enUS;
        if (activeLanguage === 'es') return esES;
        return frFR;
    }, [activeLanguage]);
}

export default function App() {
    useInitApp();
    useTtsSetup();
    useThemeSync();
    const antdLocale = useAntdLocale();
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

    const appTheme = useMemo(() => {
        const isDark = resolvedTheme === 'dark';
        return {
            algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            cssVar: { prefix: 'ant' },
            token: {
                colorPrimary: '#1990ff',
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
    }, [resolvedTheme]);

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
