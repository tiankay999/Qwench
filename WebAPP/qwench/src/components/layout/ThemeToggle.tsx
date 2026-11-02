"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Both icons are rendered and CSS hides one.
 *
 * The usual `mounted` flag set from an effect is a hydration workaround that
 * costs a render and trips react-hooks/set-state-in-effect. next-themes puts
 * `class="dark"` on <html> before paint, so Tailwind's `dark:` variant can do
 * the same job with no state at all, and the server and client markup match.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
      aria-label="Switch between light and dark"
    >
      <Moon className="w-5 h-5 text-text-secondary dark:hidden" aria-hidden />
      <Sun className="w-5 h-5 text-text-secondary hidden dark:block" aria-hidden />
    </button>
  );
}
