import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme, loadTheme, saveTheme, type ThemeName } from "@/lib/theme";

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("fellowship");

  useEffect(() => {
    const t = loadTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    saveTheme(t);
    applyTheme(t);
  };

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
