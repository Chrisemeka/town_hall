import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/public/MobileNav";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import type { Theme } from "@/lib/theme";

/**
 * Marketing nav, desktop and sheet both.
 *
 * Never add an entry here before its page exists — a nav link to a 404 is the
 * one thing the revamp brief calls out by name.
 */
const NAV: { href: string; label: string }[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];

export function PublicHeader({ theme }: { theme: Theme }) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-surface/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-full flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <Logo size={32} />
          <span className="font-syne font-bold text-[18px] tracking-tight text-ink">
            Twnhall
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[14px] text-ink-muted hover:text-ink transition-colors duration-150 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {label}
              </Link>
            ))}
          </nav>

          <ThemeToggle theme={theme} />

          {/* Sign in is secondary; Get started is the one Voltage fill per
              viewport (Design.md §7.2), always with Obsidian text on it —
              never accent ink on a light ground. Google moved onto the auth
              pages themselves, above the divider. */}
          <Link
            href="/login"
            className="hidden sm:inline-flex h-11 px-4 items-center rounded-[8px] font-mono font-medium text-[14px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="shrink-0 h-11 px-4 inline-flex items-center bg-accent text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Get started
          </Link>

          <MobileNav links={[...NAV, { href: "/login", label: "Sign in" }]} />
        </div>
      </div>
    </header>
  );
}
