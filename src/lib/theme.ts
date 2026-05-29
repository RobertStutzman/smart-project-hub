export const THEMES = ["fellowship", "synthwave", "sanctuary"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_META: Record<ThemeName, { label: string; description: string }> = {
  fellowship: { label: "Fellowship", description: "Parchment & emerald" },
  synthwave: { label: "Synthwave", description: "Neon & VHS scanlines" },
  sanctuary: { label: "Sanctuary", description: "Royal purple & gold" },
};

const KEY = "btd:theme";
const DEFAULT_THEME: ThemeName = "synthwave";

export function loadTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = window.localStorage.getItem(KEY);
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as ThemeName) : DEFAULT_THEME;
}

export function saveTheme(name: ThemeName) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name);
}

export function applyTheme(name: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", name);
}
