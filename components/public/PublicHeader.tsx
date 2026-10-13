import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DesktopNav } from "@/components/public/DesktopNav";
import { HeaderCta } from "@/components/public/HeaderCta";
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
    <header className="sticky [@media(max-height:479px)]:static top-0 z-50 h-16 bg-surface/85 backdrop-blur-md border-b border-line">
      {/* Full width with a fixed inset, not the 1200px content column: on a
          wide screen the column left the logo and CTA ~350px from the edges. */}
      <div className="px-4 medium:px-6 lg:px-10 h-full flex items-center justify-between gap-4">
        <Link href="/" className="flex max-lg:h-12 items-center gap-2 shrink-0 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <Logo size={32} className="max-lg:size-6" />
          {/* Visually hidden below 360px, never removed: the link still
              reads "Twnhall". */}
          <span className="max-[359px]:sr-only font-syne font-bold text-[16px] lg:text-[18px] tracking-tight text-ink">
            Twnhall
          </span>
        </Link>

        <div className="flex items-center gap-2 medium:gap-4">
          <DesktopNav links={NAV} />

          {/* Below 600px the toggle lives in the sheet: it is neither the
              brand, the call to action nor the way to everything else, and
              at 360px the bar only fits those three. */}
          <div className="hidden medium:flex">
            <ThemeToggle theme={theme} />
          </div>

          {/* Sign in is secondary; the Voltage "Get started" is HeaderCta.
              Google moved onto the auth pages themselves, above the divider. */}
          <Link
            href="/login"
            className="hidden medium:inline-flex h-12 lg:h-11 px-4 items-center rounded-[8px] font-mono font-medium text-[14px] text-ink hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Sign in
          </Link>
          <HeaderCta />

          <MobileNav links={NAV} theme={theme} />
        </div>
      </div>
    </header>
  );
}
