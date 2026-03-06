import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { useInitApp } from './hooks/index';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';

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
        <ConfigProvider locale={frFR} theme={appTheme}>
            <AppLayout>
                <ContentApp />
            </AppLayout>
        </ConfigProvider>
    );
}
