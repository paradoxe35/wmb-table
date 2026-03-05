import { createRoot } from 'react-dom/client';
import './assets/context-menu.css';
import './assets/sermon-view.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(<App />);
}
