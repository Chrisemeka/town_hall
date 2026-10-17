"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent } from "@/components/public/DesktopNav";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { Sheet } from "@/components/ui/Sheet";
import type { Theme } from "@/lib/theme";

const ROW =
  "flex min-h-12 items-center px-2 font-mono text-[16px] text-ink rounded-[8px] hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * The marketing nav below 840px.
 *
 * "Get started" is never repeated here: it stays in the bar behind the scrim,
 * and the sheet must not hold a second Voltage fill. Below 600px the theme
 * toggle moves in here, because the bar only has room for the brand, the call
 * to action and this menu.
 */
export function MobileNav({
  links,
  theme,
}: {
  links: { href: string; label: string }[];
  theme: Theme;
}) {
  const pathname = usePathname();

  return (
    <Sheet
      id="public-nav-sheet"
      label="Site menu"
      openLabel="Open menu"
      closeLabel="Close menu"
      trigger={{ kind: "menu" }}
      width="w-[min(22.5rem,85vw)]"
      bandClassName="h-16"
    >
      {(close) => (
        <>
          <nav className="mt-4 flex flex-col">
            {links.map(({ href, label }) => {
              const current = isCurrent(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  // Client-side navigation leaves the dialog open otherwise.
                  onClick={close}
                  className={`${ROW} ${
                    current ? "font-medium underline decoration-accent-ink decoration-2 underline-offset-8" : ""
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-line flex flex-col">
            <Link href="/login" onClick={close} className={ROW}>
              Sign in
            </Link>
            <div className="medium:hidden">
              <ThemeToggle theme={theme} labelled />
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
