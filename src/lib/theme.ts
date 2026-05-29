export const THEMES = ["fellowship", "synthwave", "sanctuary"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_META: Record<ThemeName, { label: string; description: string }> = {
  fellowship: { label: "Fellowship", description: "Parchment & emerald" },
  synthwave: { label: "Synthwave", description: "Neon & VHS scanlines" },
  sanctuary: { label: "Sanctuary", description: "Royal purple & gold" },
};

const KEY = "btd:theme";

export function loadTheme(): ThemeName {
  if (typeof window === "undefined") return "fellowship";
  const v = window.localStorage.getItem(KEY);
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as ThemeName) : "fellowship";
}

export function saveTheme(name: ThemeName) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name);
}

export function applyTheme(name: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", name);
}
