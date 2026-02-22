import { AnimatePresence, LazyMotion, domMax, m } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();

  return (
    <LazyMotion features={domMax}>
      <m.button
        type="button"
        onClick={toggleTheme}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-light text-muted-foreground/50 transition-colors duration-150 hover:text-primary"
        aria-label="Toggle theme"
      >
        <span className="relative h-3.5 w-3.5">
          {mounted ? (
            <AnimatePresence mode="wait" initial={false}>
              {theme === "dark" ? (
                <m.span
                  key="moon"
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-0"
                >
                  <Moon weight="duotone" className="h-3.5 w-3.5" />
                </m.span>
              ) : (
                <m.span
                  key="sun"
                  initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-0"
                >
                  <Sun weight="duotone" className="h-3.5 w-3.5" />
                </m.span>
              )}
            </AnimatePresence>
          ) : (
            <>
              <span className="absolute inset-0 dark:hidden">
                <Sun weight="duotone" className="h-3.5 w-3.5" />
              </span>
              <span className="absolute inset-0 hidden dark:block">
                <Moon weight="duotone" className="h-3.5 w-3.5" />
              </span>
            </>
          )}
        </span>
        {mounted ? (
          <span>{theme === "dark" ? "Dark" : "Light"}</span>
        ) : (
          <>
            <span className="dark:hidden">Light</span>
            <span className="hidden dark:inline">Dark</span>
          </>
        )}
      </m.button>
    </LazyMotion>
  );
}
