"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/actions/auth"
import { ReplayTourButton } from "@/components/tours/ReplayTourButton"
import { NAV, navIsActive } from "@/lib/appNav"
import type { AccountType } from "@/lib/access"

function NavItem({
  href,
  name,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string
  name: string
  icon: React.ElementType
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 h-10 px-3 rounded-[8px] font-mono text-[14px] transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        isActive ? "text-accent-ink bg-voltage/[0.06]" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {name}
    </Link>
  )
}

export function Sidebar({
  isOpen,
  onClose,
  account = "builder",
}: {
  isOpen: boolean
  onClose: () => void
  account?: AccountType
}) {
  const pathname = usePathname()


  const isActive = (href: string) => navIsActive(pathname, href)

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 w-[240px] bg-surface border-r border-line flex flex-col z-40 pt-[56px] transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">

        <div>
          <p className="font-mono text-[11px] font-medium text-ink-muted uppercase tracking-[1px] mb-3 px-3">
            {NAV[account].heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV[account].links.map((link) => (
              <NavItem key={link.href} href={link.href} name={link.name} icon={link.icon} isActive={isActive(link.href)} onClick={onClose} />
            ))}
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="mt-auto pt-6 border-t border-line">
          <p className="font-mono text-[11px] font-medium text-ink-muted uppercase tracking-[1px] mb-3 px-3">
            Account · {account}
          </p>
          <div className="flex flex-col gap-0.5">

            {/*
              Exactly three, and Sign out is one of them.

              Switching or adding a role used to live here; it is in Settings →
              Profile now, which is the one place a builder can reach the
              tester side and where the copy has room to say that adding one
              means completing a tester profile first.

              Sign out came DOWN from TopNav, and it is in this shared block
              rather than the desktop-only one on purpose. The sidebar
              collapses to a sheet on mobile, so a desktop-only sign-out would
              put logging out behind a menu that was not previously needed to
              leave — while "back button reaches dashboard after logout" is
              still open on the QA list. It used to exist three times: here for
              mobile, in TopNav for every width, and nowhere for desktop rail
              users. Now it is one control in one place.
            */}
            <NavItem
              href="/settings"
              name="Settings"
              icon={Settings}
              isActive={isActive("/settings")}
              onClick={onClose}
            />
            <ReplayTourButton onClick={onClose} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-3 h-10 w-full px-3 rounded-[8px] font-mono text-[14px] text-ink-muted hover:text-ink transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign out
              </button>
            </form>
          </div>
        </div>

      </div>
    </aside>
  )
}
