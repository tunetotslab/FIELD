export type ThemePreference = 'light' | 'system';
let preference: ThemePreference | undefined;
export function getThemePreference(): ThemePreference {
  if (preference) return preference;
  try { return localStorage.getItem('field-theme') === 'system' ? 'system' : 'light'; }
  catch { return 'light'; }
}
export function applyTheme() {
  const app = window.Telegram?.WebApp;
  const dark = getThemePreference() === 'system' &&
    (app?.colorScheme ? app.colorScheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const color = dark ? '#191619' : '#fffaf7';
  try { app?.setHeaderColor?.(color); app?.setBackgroundColor?.(color); } catch { /* Older Telegram. */ }
}
export function setThemePreference(value: ThemePreference) {
  preference = value;
  try { localStorage.setItem('field-theme', value); } catch { /* Session only. */ }
  applyTheme();
}
export function initTheme() {
  applyTheme();
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', applyTheme);
  window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme);
  return () => {
    media.removeEventListener('change', applyTheme);
    window.Telegram?.WebApp?.offEvent?.('themeChanged', applyTheme);
  };
}
