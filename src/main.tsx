import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/caveat';
import '@fontsource-variable/fraunces';
import '@fontsource/unifrakturcook/700.css';
import './design-system/tokens.css';
import './styles.css';
import './visual-cleanup.css';
import { I18nProvider } from './i18n';

createRoot(document.getElementById('root')!).render(<StrictMode><I18nProvider><App /></I18nProvider></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
