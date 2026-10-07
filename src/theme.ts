export type ThemePreference = "light" | "dark";
let preference: ThemePreference | undefined;
export function getThemePreference(): ThemePreference {
  if (preference) return preference;
  try {
    const saved = localStorage.getItem("field-theme");
    return saved === "dark" || saved === "system" ? "dark" : "light";
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
    localStorage.setItem("field-theme", value);
  } catch {
    /* Session only. */
  }
  applyTheme();
}
export function initTheme() {
  applyTheme();
  return () => undefined;
}
