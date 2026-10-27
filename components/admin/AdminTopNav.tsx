"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, LogOut, Menu, ShieldCheck, X } from "lucide-react"
import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/actions/auth"

// The admin shell: a header with the alert bell on every page, a left sidebar
// from lg up (nine destinations no longer fit a top bar), and a sheet below.

const NAV_LINKS = [
  { name: "Overview", href: "/admin" },
  { name: "Accounts", href: "/admin/accounts" },
  { name: "Projects", href: "/admin/projects" },
  { name: "Test Cases", href: "/admin/missions" },
  { name: "Submissions", href: "/admin/submissions" },
  { name: "AI", href: "/admin/ai-reports" },
  { name: "Payouts", href: "/admin/payouts" },
  { name: "Email", href: "/admin/email" },
  { name: "Alerts", href: "/admin/alerts" },
]

export type BellAlert = { id: string; name: string; severity: string; value: number | null; href: string }

export function AdminTopNav({ openCount, critical, latest }: { openCount: number; critical: boolean; latest: BellAlert[] }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/")

  const links = (onClick?: () => void) =>
    NAV_LINKS.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClick}
        aria-current={isActive(link.href) ? "page" : undefined}
        className={cn(
          "h-12 lg:h-10 px-3 rounded-[8px] font-mono text-[14px] flex items-center justify-between transition-colors duration-150",
          isActive(link.href) ? "text-accent-ink bg-voltage/[0.06]" : "text-ink-muted hover:text-ink hover:bg-ink/[0.06]",
        )}
      >
        {link.name}
        {link.href === "/admin/alerts" && openCount > 0 && (
          <span className={cn("font-mono text-[12px] tabular-nums", critical ? "text-danger-ink" : "text-ink")}>{openCount}</span>
        )}
      </Link>
    ))

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[56px] bg-surface border-b border-line z-50 flex items-center px-4 lg:px-6 justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <Logo size={20} onDark />
            <span className="font-syne font-bold text-[18px] text-ink tracking-tight">Twnhall</span>
          </Link>
          <span className="hidden medium:flex items-center gap-1 font-mono text-[12px] uppercase tracking-[1px] text-accent-ink border border-accent-ink rounded px-2 h-6 shrink-0">
            <ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Native disclosure: no state, closes on navigation because the page changes. */}
          <details className="relative" key={pathname}>
            <summary
              aria-label={`Alerts: ${openCount} open${critical ? ", including critical" : ""}`}
              className="list-none [&::-webkit-details-marker]:hidden h-12 w-12 lg:h-10 lg:w-10 flex items-center justify-center rounded-[8px] text-ink-muted hover:text-ink hover:bg-ink/[0.06] cursor-pointer relative"
            >
              <Bell className="w-5 h-5" />
              {openCount > 0 && (
                <span
                  className={cn(
                    "absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full font-mono text-[12px] leading-5 text-center tabular-nums",
                    critical ? "bg-ember text-obsidian" : "bg-voltage text-obsidian",
                  )}
                >
                  {openCount}
                </span>
              )}
            </summary>
            <div className="absolute right-0 mt-2 w-[min(320px,calc(100vw-32px))] rounded-[12px] border border-line bg-surface-raised shadow-lg z-50">
              {latest.length === 0 ? (
                <p className="p-4 font-mono text-[14px] text-ink-muted">No open alerts.</p>
              ) : (
                <ul>
                  {latest.map((a) => (
                    <li key={a.id} className="border-b border-line">
                      <Link href={a.href} className="block px-4 py-3 hover:bg-ink/[0.06]">
                        <span className={cn("block font-mono text-[12px] uppercase tracking-[1px]", a.severity === "critical" ? "text-danger-ink" : "text-ink-muted")}>{a.severity}</span>
                        <span className="block font-mono text-[14px] text-ink">
                          {a.name}
                          {a.value !== null ? `: ${a.value}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/alerts" className="block px-4 h-12 leading-[48px] font-mono text-[14px] text-accent-ink">All alerts</Link>
            </div>
          </details>

          <form action={signOutAction} className="hidden lg:block">
            <button type="submit" className="flex items-center gap-2 h-10 px-2 text-ink-muted hover:text-ink transition-colors duration-150 font-mono text-[14px]">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>

          <button
            type="button"
            className="lg:hidden h-12 w-12 flex items-center justify-center text-ink-muted hover:text-ink transition-colors duration-150"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <aside className="hidden lg:flex fixed top-[56px] bottom-0 left-0 w-[240px] border-r border-line bg-surface flex-col gap-1 p-4 overflow-y-auto z-40">
        <nav aria-label="Admin" className="flex flex-col gap-1">{links()}</nav>
      </aside>

      {mobileOpen && (
        <>
          <div
            // ponytail: a literal, deliberately. A drawer scrim is dark on
            // both themes — it exists to push the page back, and a scrim
            // that follows the theme stops being one in light mode.
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-[56px] left-0 right-0 bg-surface border-b border-line z-40 lg:hidden max-h-[calc(100vh-56px)] overflow-y-auto">
            <nav aria-label="Admin" className="flex flex-col px-4 py-4 gap-1">
              {links(() => setMobileOpen(false))}
              <form action={signOutAction} className="mt-2 pt-2 border-t border-line">
                <button type="submit" className="flex items-center gap-2 h-12 px-3 w-full text-ink-muted hover:text-ink transition-colors duration-150 font-mono text-[14px]">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </form>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
