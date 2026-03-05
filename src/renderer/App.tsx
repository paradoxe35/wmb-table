import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { useInitApp } from './hooks/index';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';

export default function App() {
    useInitApp();

    return (
        <ConfigProvider locale={frFR}>
            <AppLayout>
                <ContentApp />
            </AppLayout>
        </ConfigProvider>
    );
}
