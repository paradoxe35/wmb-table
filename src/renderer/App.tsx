import { App as AntApp, ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { useInitApp } from './hooks/index';
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

export default function App() {
    useInitApp();

    return (
        <ErrorBoundary>
            <ConfigProvider locale={frFR} theme={appTheme}>
                <AntApp>
                    <AppLayout>
                        <ContentApp />
                    </AppLayout>
                </AntApp>
            </ConfigProvider>
        </ErrorBoundary>
    );
}
