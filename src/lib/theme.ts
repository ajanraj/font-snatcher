export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DARK_CLASS = "dark";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function getThemeStorage(windowRef: Window): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    const storage = windowRef.localStorage;
    if (typeof storage?.getItem === "function" && typeof storage?.setItem === "function") {
      return storage;
    }
  } catch {
    return null;
  }

  return null;
}

export function readStoredTheme(windowRef: Window): Theme | null {
  const storage = getThemeStorage(windowRef);
  if (!storage) {
    return null;
  }

  const storedTheme = storage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return null;
}

function prefersDarkMode(windowRef: Window): boolean {
  if (typeof windowRef.matchMedia !== "function") {
    return false;
  }

  return windowRef.matchMedia(DARK_MEDIA_QUERY).matches;
}

export function resolveTheme(storedTheme: Theme | null, prefersDark: boolean): Theme {
  if (storedTheme) {
    return storedTheme;
  }

  return prefersDark ? "dark" : "light";
}

export function getPreferredTheme(windowRef: Window): Theme {
  return resolveTheme(readStoredTheme(windowRef), prefersDarkMode(windowRef));
}

export function persistTheme(windowRef: Window, theme: Theme): void {
  const storage = getThemeStorage(windowRef);
  storage?.setItem(THEME_STORAGE_KEY, theme);
}

export function applyThemeToRoot(root: HTMLElement, theme: Theme): void {
  root.classList.toggle(DARK_CLASS, theme === "dark");
  root.style.colorScheme = theme;
}

export function createThemeInitScript(): string {
  return `(()=>{try{const stored=window.localStorage.getItem("${THEME_STORAGE_KEY}");const prefersDark=typeof window.matchMedia==="function"&&window.matchMedia("${DARK_MEDIA_QUERY}").matches;const theme=stored==="dark"||stored==="light"?stored:(prefersDark?"dark":"light");const root=document.documentElement;root.classList.toggle("${DARK_CLASS}",theme==="dark");root.style.colorScheme=theme;}catch{}})();`;
}
