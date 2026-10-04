"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** /guides/builder is still Guides. */
export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The marketing nav from 768px up. A client component only for usePathname;
 * the header around it stays a server component.
 *
 * The current page is ink *and* underlined — colour never carries state alone
 * (Design.md §10) — and aria-current tells a screen reader the same thing.
 */
export function DesktopNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-8">
      {links.map(({ href, label }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`text-[14px] transition-colors duration-150 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              current
                ? "text-ink underline decoration-accent-ink decoration-2 underline-offset-8"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
