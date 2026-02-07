import { useEffect, useState } from "react";
import { applyThemeToRoot, getPreferredTheme, persistTheme, type Theme } from "../lib/theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return getPreferredTheme(window);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      persistTheme(window, newTheme);
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  useEffect(() => {
    applyThemeToRoot(document.documentElement, theme);
  }, [theme]);

  return { theme, setTheme, toggleTheme } as const;
}
