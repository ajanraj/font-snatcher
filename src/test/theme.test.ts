import { describe, expect, it } from "vitest";
import { applyThemeToRoot, resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("uses stored theme when available", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to system preference when storage is empty", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
});

describe("applyThemeToRoot", () => {
  it("applies dark class and color-scheme to root", () => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "";

    applyThemeToRoot(root, "dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");

    applyThemeToRoot(root, "light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });
});
