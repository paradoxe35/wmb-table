import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { useInitApp } from './hooks/index';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';

const appTheme = {
    token: {
        colorPrimary: '#4a6fa5',
        colorBgContainer: '#ffffff',
        colorBgLayout: '#f5f6f8',
        borderRadius: 6,
        colorBorder: '#e8eaed',
        colorText: '#1f2937',
        colorTextSecondary: '#6b7280',
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
        fontSize: 14,
    },
    components: {
        Layout: {
            headerBg: '#001528',
            headerHeight: 48,
            headerPadding: '0',
            siderBg: '#ffffff',
            bodyBg: '#f5f6f8',
        },
        Menu: {
            darkItemBg: '#001528',
            darkItemSelectedBg: '#002040',
            itemSelectedBg: '#e8f0fe',
            itemSelectedColor: '#4a6fa5',
        },
        Card: { borderRadiusLG: 8 },
        Collapse: { headerBg: '#fafbfc', contentBg: '#ffffff' },
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
