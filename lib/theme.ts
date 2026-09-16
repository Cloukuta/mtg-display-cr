export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

export const THEME_STORAGE_KEY = "mtg-display-cr-theme";

export function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function saveTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);

  applyTheme(theme);

  window.dispatchEvent(
    new CustomEvent("mtg-theme-change", {
      detail: theme,
    })
  );
}