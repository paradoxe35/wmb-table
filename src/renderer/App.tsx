import { useEffect, useMemo } from 'react';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { resolveUiLanguage, type UiLanguage } from '@shared/constants';
import { HEADER_BACKGROUND } from '@shared/theme';
import { useAppStore } from './stores';
import type { Locale } from 'antd/es/locale';
import 'dayjs/locale/es';
import 'dayjs/locale/fr';
import 'dayjs/locale/pt-br';
import frFR from 'antd/locale/fr_FR';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import ptBR from 'antd/locale/pt_BR';

import { useTranslation } from 'react-i18next';
import { useInitApp } from './hooks/index';
import { useBibleSetup } from './hooks/use-bible-setup';
import { useTtsSetup } from './hooks/use-tts-setup';
import { useThemeSync } from './hooks/use-theme';
import { startPowerSaveController } from './services/power-save-controller';
import { useThemeStore, FONT_SIZE_MAP } from './stores/theme.store';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';
import { ErrorBoundary } from './components/error-boundary';

const ANTD_LOCALES: Record<UiLanguage, Locale> = {
    fr: frFR,
    en: enUS,
    es: esES,
    pt: ptBR,
    sw: enUS,
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
    useBibleSetup();
    useTtsSetup();
    useThemeSync();
    useEffect(() => {
        startPowerSaveController();
    }, []);
    const antdLocale = useAntdLocale();
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const fontSizeOption = useThemeStore((s) => s.fontSizeOption);

    const appTheme = useMemo(() => {
        const isDark = resolvedTheme === 'dark';
        const headerBg = HEADER_BACKGROUND[resolvedTheme];
        return {
            algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
            cssVar: { prefix: 'ant' },
            token: {
                colorPrimary: '#1990ff',
                fontSize: FONT_SIZE_MAP[fontSizeOption],
            },
            components: {
                Layout: {
                    headerBg,
                    headerPadding: '0',
                    siderBg: isDark ? '#1f1f1f' : '#ffffff',
                },
                Menu: {
                    darkItemBg: headerBg,
                    darkItemSelectedBg: '#1990ff',
                },
            },
        };
    }, [resolvedTheme, fontSizeOption]);

    // antd's static APIs (message/notification/Modal) render into a detached
    // holder outside this provider, so they need the theme and locale registered
    // globally or they always paint in the default light theme.
    useEffect(() => {
        ConfigProvider.config({
            holderRender: (children) => (
                <ConfigProvider locale={antdLocale} theme={appTheme}>
                    {children}
                </ConfigProvider>
            ),
        });
    }, [antdLocale, appTheme]);

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
