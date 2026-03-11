import { createRoot } from 'react-dom/client';
import './i18n';
import './assets/context-menu.css';
import './assets/sermon-view.scss';
import './assets/app.scss';
import App from './App';

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(<App />);
}
