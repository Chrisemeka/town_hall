import { cookies } from "next/headers"
import { Logo } from "@/components/Logo"
import { THEME_COOKIE, readTheme } from "@/lib/theme"

/**
 * The shell the three setup routes opt into — /terms-accept,
 * /choose-account and /verify/[role].
 *
 * They stay three routes. Each is a real gate with its own column, checked in
 * middleware AND in page/action code per CLAUDE.md; collapsing them into one
 * page means re-implementing that routing inside the page and giving up the
 * two-layer guarantee. What this fixes is that they did not *look* like one
 * chain: three shells, three widths, no sense of progress.
 *
 * It owns data-theme for the same reason app/(public)/layout.tsx does — these
 * routes are post-auth but pre-dashboard, so they belong to the themed
 * surface, not the dark app surface. Reading the cookie here rather than in
 * the root layout keeps the dynamic rendering on the routes that need it.
 *
 * No theme toggle: the setting arrives from the public site, and a second
 * thing to decide in the middle of a task is not a kindness.
 */
export async function SetupShell({
  context,
  indicator,
  width = "narrow",
  children,
}: {
  /** The line beside the logo. Never assume setup — see /choose-account. */
  context: string
  /** Rendered above the card. Omitted where there is no progress to show. */
  indicator?: React.ReactNode
  /** The role picker needs 760px for two cards side by side; the rest do not. */
  width?: "narrow" | "wide"
  children: React.ReactNode
}) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <div
      data-theme={theme}
      className="min-h-screen flex flex-col bg-surface text-ink font-mono selection:bg-accent selection:text-obsidian"
    >
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-syne font-bold text-[18px] text-ink">Twnhall</span>
          </div>
          <p className="font-mono text-[13px] text-ink-muted">{context}</p>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-12 lg:py-16">
        <div
          className={`mx-auto w-full ${width === "wide" ? "max-w-[760px]" : "max-w-[640px]"}`}
        >
          {indicator}
          {children}
        </div>
      </main>
    </div>
  )
}
