"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV, activeNavHref } from "@/lib/appNav"
import type { AccountType } from "@/lib/access"

/**
 * M3 navigation bar: the three destinations below 840px, one tap each, in
 * thumb reach. From 840px the sidebar lists the same links (lib/appNav).
 *
 * Active is shown three ways — the pill, the ink colour and the label's
 * weight — plus aria-current, so colour never carries it alone.
 *
 * Hidden while a text field has focus: on Android the keyboard shrinks the
 * viewport and a fixed bar rides up over the field being typed into. The
 * shell is `group/shell`. A <select> is left out — its picker overlays the
 * page and opens no keyboard — and so are checkboxes and radios.
 *
 * It also steps aside for the audit log's progress bar (ReportProgressBar),
 * which takes its place while it shows.
 */
export function BottomNav({ account }: { account: AccountType }) {
  const pathname = usePathname()
  const current = activeNavHref(pathname, account)

  return (
    <nav
      aria-label="Main"
      className="expanded:hidden group-has-[[data-report-bar]]/shell:hidden group-has-[:is(input:not([type=checkbox]):not([type=radio]),textarea):focus]/shell:hidden fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {NAV[account].links.map(({ href, short, icon: Icon }) => {
          const active = href === current
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="group h-16 flex flex-col items-center justify-center gap-1 active:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
              >
                <span
                  className={`w-14 h-7 rounded-full inline-flex items-center justify-center transition-colors duration-150 ${
                    active ? "bg-accent-ink/[0.12] text-accent-ink" : "text-ink-muted group-hover:text-ink"
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className={`font-mono text-[12px] leading-4 ${active ? "text-ink font-medium" : "text-ink-muted"}`}>
                  {short}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
