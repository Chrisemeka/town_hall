"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { isCurrent } from "@/components/public/DesktopNav";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import type { Theme } from "@/lib/theme";

const CONTROL =
  "rounded-[8px] hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const ICON_BUTTON = `h-12 w-12 inline-flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer ${CONTROL}`;

const ROW = `flex min-h-12 items-center px-2 font-mono text-[16px] text-ink ${CONTROL}`;

// M3 modal navigation drawer: slides in from the trailing edge on open, 300ms
// ease-standard. The transition lives under `open:` so closing is instant, and
// the start offset is motion-safe so reduced motion gets no slide at all.
const SHEET = "m-0 ml-auto h-full max-h-full w-[min(22.5rem,85vw)] max-w-none rounded-l-[16px] bg-surface p-0 text-ink backdrop:bg-obsidian/60 open:transition-[translate] open:duration-300 open:ease-standard motion-safe:starting:open:translate-x-full"; // ponytail: the scrim is literal Obsidian on purpose — dark in both themes; one that follows the theme stops being a scrim.

/**
 * The marketing nav below 840px.
 *
 * ponytail: a native <dialog> opened with showModal(), not a hand-rolled sheet.
 * The platform gives the three things that are tedious and easy to get wrong —
 * focus is trapped inside while it is open, Esc closes it, and focus returns to
 * the trigger on close — for no code. `open` state exists only to drive
 * aria-expanded on the button and the icon swap; the dialog's own `close` event
 * keeps it honest when Esc or the backdrop closes it without us.
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
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => ref.current?.close();

  return (
    <div className="expanded:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="public-nav-sheet"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className={ICON_BUTTON}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <dialog
        id="public-nav-sheet"
        ref={ref}
        onClose={() => setOpen(false)}
        // A tap on the scrim lands on the dialog itself — its content box
        // fills it edge to edge, so anything else is a tap inside.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-label="Site menu"
        // A dialog is centred and auto-sized by default; these pin it to the
        // right as a full-height sheet. backdrop:bg-* styles ::backdrop.
        className={SHEET}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className={ICON_BUTTON}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

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
        </div>
      </dialog>
    </div>
  );
}
