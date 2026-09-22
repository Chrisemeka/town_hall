import { cookies } from "next/headers"
import { Logo } from "@/components/Logo"
import { ThemeToggle } from "@/components/public/ThemeToggle"
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
 * It no longer owns data-theme — app/layout.tsx sets that once on <html> for
 * every route. The cookie is still read here because the toggle needs to know
 * which way to point.
 *
 * It carries the theme toggle. The setting does arrive from the public site —
 * one cookie at path=/, read here and in the public layout by the same
 * readTheme() — but this chain is gated, so somebody who lands in a theme they
 * dislike has no way back to a control until setup is finished. Being stuck in
 * it is worse than the small distraction of offering the switch.
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
    <div className="min-h-screen flex flex-col bg-surface text-ink font-mono selection:bg-accent selection:text-obsidian">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-syne font-bold text-[18px] text-ink">Twnhall</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Hidden below 640px: the mark, this line and a 44px control come
                to ~364px against the 312px a 360px viewport leaves. The line is
                orientation; the toggle is a control, so the line gives way. */}
            <p className="hidden sm:block font-mono text-[13px] text-ink-muted">
              {context}
            </p>
            <ThemeToggle theme={theme} />
          </div>
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
