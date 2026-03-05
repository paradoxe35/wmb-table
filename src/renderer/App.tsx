import { useInitApp } from './hooks/index';
import AppLayout from './components/layout';
import { ContentApp } from './content-app';

export default function App() {
    useInitApp();

    return (
        <AppLayout>
            <ContentApp />
        </AppLayout>
    );
}
