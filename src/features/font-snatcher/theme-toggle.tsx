import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const Icon = theme === "dark" ? Moon : Sun;
  const label = theme === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
      aria-label={`Theme: ${label}. Click to toggle.`}
    >
      <span className="relative h-3.5 w-3.5">
        <Icon
          weight="duotone"
          className="absolute inset-0 h-3.5 w-3.5 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-hover:rotate-12 group-hover:scale-110"
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
