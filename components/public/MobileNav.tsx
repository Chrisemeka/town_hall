"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/**
 * The marketing nav below 768px.
 *
 * ponytail: a native <dialog> opened with showModal(), not a hand-rolled sheet.
 * The platform gives the three things that are tedious and easy to get wrong —
 * focus is trapped inside while it is open, Esc closes it, and focus returns to
 * the trigger on close — for no code. `open` state exists only to drive
 * aria-expanded on the button and the icon swap; the dialog's own `close` event
 * keeps it honest when Esc or the backdrop closes it without us.
 *
 * The theme toggle and the sign-in CTA stay in the bar at every width. They are
 * one tap each and hiding them behind a menu would be worse.
 */
export function MobileNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = () => ref.current?.close();

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="public-nav-sheet"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className="h-11 w-11 inline-flex items-center justify-center rounded-[8px] text-ink-muted hover:text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <dialog
        id="public-nav-sheet"
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label="Site menu"
        // A dialog is centred and auto-sized by default; these pin it to the
        // right as a full-height sheet. backdrop:bg-* styles ::backdrop.
        className="m-0 ml-auto h-full max-h-full w-[min(20rem,85vw)] max-w-none bg-surface p-0 text-ink backdrop:bg-obsidian/60"
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="h-11 w-11 inline-flex items-center justify-center rounded-[8px] text-ink-muted hover:text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <nav className="mt-4 flex flex-col">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                // Client-side navigation leaves the dialog open otherwise.
                onClick={close}
                className="flex min-h-11 items-center rounded-[8px] px-2 font-mono text-[16px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </div>
  );
}
