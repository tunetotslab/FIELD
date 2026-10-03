import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/caveat';
import '@fontsource-variable/fraunces';
import '@fontsource/unifrakturcook/700.css';
import './design-system/tokens.css';
import './styles.css';
import './visual-cleanup.css';
import './responsive.css';
import { applyTheme } from './theme';
import { I18nProvider } from './i18n';

import { restoreSession } from './auth/session';
async function boot() {
  await restoreSession().catch(() => {
    // Private recording stays available when account storage cannot open.
  });
  applyTheme();
  createRoot(document.getElementById('root')!).render(
    <StrictMode><I18nProvider><App /></I18nProvider></StrictMode>,
  );
}
void boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
