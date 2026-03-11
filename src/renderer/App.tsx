import { useEffect, useMemo } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import type { Locale } from 'antd/es/locale';
import frFR from 'antd/locale/fr_FR';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import { useTranslation } from 'react-i18next';
import { useInitApp } from './hooks/index';
import { useAppStore } from './stores';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';
import { ErrorBoundary } from './components/error-boundary';

const appTheme = {
    token: {
        colorPrimary: '#1990ff',
    },
    components: {
        Layout: {
            headerBg: '#001529',
            headerPadding: '0',
            siderBg: '#ffffff',
        },
        Menu: {
            darkItemBg: '#001529',
            darkItemSelectedBg: '#1990ff',
        },
    },
};

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
    const antdLocale = useAntdLocale();

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
