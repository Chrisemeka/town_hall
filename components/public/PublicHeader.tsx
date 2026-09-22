import Link from "next/link";
import { signInWithGoogle } from "@/actions/auth";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/public/MobileNav";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import type { Theme } from "@/lib/theme";

/**
 * Marketing nav, desktop and sheet both.
 *
 * Never add an entry here before its page exists — a nav link to a 404 is the
 * one thing the revamp brief calls out by name. "Get started" joins this list
 * in the PR that creates /signup.
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

          {/*
            The one Voltage CTA per viewport (Design.md §7.2). Voltage is a
            fill here and always carries Obsidian text — never accent ink on a
            light ground. PR 3 replaces this with the Sign in / Get started
            pair once /login and /signup exist.
          */}
          <form action={signInWithGoogle} className="shrink-0">
            <button
              type="submit"
              className="h-11 px-4 inline-flex items-center bg-accent text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {/* Full label needs ~200px, which does not fit beside the
                  wordmark and toggle at 360px. */}
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Continue with Google</span>
            </button>
          </form>

          <MobileNav links={NAV} />
        </div>
      </div>
    </header>
  );
}
