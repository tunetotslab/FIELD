import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/caveat';
import '@fontsource-variable/fraunces';
import '@fontsource/unifrakturcook/700.css';
import './design-system/tokens.css';
import './styles.css';
import './visual-cleanup.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
