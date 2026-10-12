"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { otherTheme, writeThemeCookie, type Theme } from "@/lib/theme";

/**
 * Writes the theme cookie and refreshes so the server layout re-renders with
 * the new `data-theme`.
 *
 * ponytail: `document.cookie` rather than a server action. A display
 * preference is not a trust boundary — the layout maps the value onto one of
 * two known strings on read (see readTheme), so a hand-edited cookie can only
 * ever resolve to "light" or "dark". If the theme ever needs to be known
 * server-side for something that matters, that is the point to move it into an
 * action with a Zod schema.
 */
export function ThemeToggle({
  theme,
  labelled = false,
}: {
  theme: Theme;
  /** A full-width row with a visible label, for the mobile sheet. */
  labelled?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const next = otherTheme(theme);

  return (
    <button
      type="button"
      // Names the destination, not the current state — "Dark theme" on a button
      // is ambiguous about whether it describes what you have or what you get.
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        writeThemeCookie(next);
        startTransition(() => router.refresh());
      }}
      className={`${
        labelled
          ? "flex min-h-12 w-full items-center gap-3 px-2 font-mono text-[16px] text-ink"
          : "h-12 w-12 lg:h-11 lg:w-11 inline-flex items-center justify-center text-ink-muted hover:text-ink"
      } rounded-[8px] hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
      {/* Names the destination too, and sits inside the accessible name. */}
      {labelled && <span>{next === "dark" ? "Dark theme" : "Light theme"}</span>}
    </button>
  );
}
