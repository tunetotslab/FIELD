export type ThemePreference = "light" | "dark";
const THEME_CHOICE_KEY = "field-theme-choice-v2";
let preference: ThemePreference | undefined;
export function getThemePreference(): ThemePreference {
  if (preference) return preference;
  try {
    return localStorage.getItem(THEME_CHOICE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function applyTheme() {
  const app = window.Telegram?.WebApp;
  const dark = getThemePreference() === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const color = dark ? "#191619" : "#fffaf7";
  try {
    app?.setHeaderColor?.(color);
    app?.setBackgroundColor?.(color);
  } catch {
    /* Older Telegram. */
  }
}
export function setThemePreference(value: ThemePreference) {
  preference = value;
  try {
    localStorage.setItem(THEME_CHOICE_KEY, value);
    localStorage.removeItem("field-theme");
  } catch {
    /* Session only. */
  }
  applyTheme();
}
export function initTheme() {
  applyTheme();
  return () => undefined;
}
