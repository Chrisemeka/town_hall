"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/actions/auth"
import { ReplayTourButton } from "@/components/tours/ReplayTourButton"
import { NAV, activeNavHref, navCurrent, navIsActive } from "@/lib/appNav"
import type { AccountType } from "@/lib/access"

function NavItem({
  href,
  name,
  icon: Icon,
  isActive,
  current,
  onClick,
  className,
}: {
  href: string
  name: string
  icon: React.ElementType
  isActive: boolean
  /** aria-current, so the active state is never colour alone (Design.md §10). */
  current?: "page" | "true"
  onClick?: () => void
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? current : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 h-10 px-3 rounded-[8px] font-mono text-[14px] transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        isActive ? "text-accent-ink bg-voltage/[0.06]" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {name}
    </Link>
  )
}

/**
 * Settings, Replay page tour, Sign out — the account block. Rendered by the
 * sidebar from 840px and by the account sheet below it, one or the other, so
 * each screen has exactly one Sign out.
 *
 * Switching or adding a role used to live here; it is in Settings → Profile
 * now, which is the one place a builder can reach the tester side and where
 * the copy has room to say that adding one means completing a tester profile
 * first.
 *
 * Sign out came DOWN from TopNav. It used to exist three times: in the mobile
 * drawer, in TopNav for every width, and nowhere for desktop rail users. Now
 * it is one control in one place per screen — and never behind a menu that
 * was not otherwise needed to leave, while "back button reaches dashboard
 * after logout" is still open on the QA list.
 */
export function AccountActions({
  onNavigate,
  rowClassName,
}: {
  /** Closes the account sheet; the sidebar passes nothing. */
  onNavigate?: () => void
  /** The sheet's 48px rows; the sidebar keeps its 40px ones. */
  rowClassName?: string
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-0.5">
      <NavItem
        href="/settings"
        name="Settings"
        icon={Settings}
        isActive={navIsActive(pathname, "/settings")}
        current={navCurrent(pathname, "/settings")}
        onClick={onNavigate}
        className={rowClassName}
      />
      <ReplayTourButton onClick={onNavigate} className={rowClassName} />
      <form action={signOutAction}>
        <button
          type="submit"
          className={cn(
            "flex items-center gap-3 h-10 w-full px-3 rounded-[8px] font-mono text-[14px] text-ink-muted hover:text-ink transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            rowClassName,
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </form>
    </div>
  )
}

/** The persistent rail. Below its breakpoint the bottom bar and the account
 *  sheet carry the same destinations and actions. */
export function Sidebar({ account = "builder" }: { account?: AccountType }) {
  const pathname = usePathname()
  const current = activeNavHref(pathname, account)

  return (
    <aside className="hidden expanded:flex fixed inset-y-0 left-0 w-[240px] bg-surface border-r border-line flex-col z-40 pt-[56px]">
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">

        <div>
          <p className="font-mono text-[12px] lg:text-[11px] font-medium text-ink-muted uppercase tracking-[1px] mb-3 px-3">
            {NAV[account].heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV[account].links.map((link) => (
              <NavItem key={link.href} href={link.href} name={link.name} icon={link.icon} isActive={link.href === current} current={navCurrent(pathname, link.href)} />
            ))}
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="mt-auto pt-6 border-t border-line">
          <p className="font-mono text-[12px] lg:text-[11px] font-medium text-ink-muted uppercase tracking-[1px] mb-3 px-3">
            Account · {account}
          </p>
          <AccountActions />
        </div>

      </div>
    </aside>
  )
}
