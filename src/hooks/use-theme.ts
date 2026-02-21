import { useEffect, useState } from "react";
import { applyThemeToRoot, getPreferredTheme, persistTheme, type Theme } from "../lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Sync with real persisted theme after hydration.
  useEffect(() => {
    setThemeState(getPreferredTheme(window));
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    persistTheme(window, newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  useEffect(() => {
    if (!mounted) return;
    applyThemeToRoot(document.documentElement, theme);
  }, [theme, mounted]);

  return { theme, mounted, setTheme, toggleTheme } as const;
}
