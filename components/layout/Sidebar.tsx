"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Target, MessageSquare,
  Telescope, Compass, Settings,
  User, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/actions/auth"
import { ReplayTourButton } from "@/components/tours/ReplayTourButton"

const MY_WORK_LINKS = [
  { name: "My Projects",       href: "/dashboard",           icon: LayoutDashboard },
  { name: "My Missions",       href: "/dashboard/missions",  icon: Target },
  { name: "Feedback Received", href: "/dashboard/feedback",  icon: MessageSquare },
]

const COMMUNITY_LINKS = [
  { name: "Explore Projects",  href: "/explore",             icon: Telescope },
  { name: "Browse Missions",   href: "/explore/missions",    icon: Compass },
]

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
        isActive ? "text-voltage bg-[rgba(232,255,71,0.06)]" : "text-ash hover:text-chalk",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {name}
    </Link>
  )
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const EXACT_MATCH = new Set(["/dashboard", "/explore"])

  const isActive = (href: string) =>
    EXACT_MATCH.has(href)
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/")

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 w-[240px] bg-obsidian border-r border-iron flex flex-col z-40 pt-[56px] transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">

        {/* MY WORK */}
        <div>
          <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px] mb-3 px-3">
            My Work
          </p>
          <div className="flex flex-col gap-0.5">
            {MY_WORK_LINKS.map((link) => (
              <NavItem key={link.href} {...link} isActive={isActive(link.href)} onClick={onClose} />
            ))}
          </div>
        </div>

        {/* COMMUNITY */}
        <div>
          <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px] mb-3 px-3">
            Community
          </p>
          <div className="flex flex-col gap-0.5">
            {COMMUNITY_LINKS.map((link) => (
              <NavItem key={link.href} {...link} isActive={isActive(link.href)} onClick={onClose} />
            ))}
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="mt-auto pt-6 border-t border-iron">
          <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px] mb-3 px-3">
            Account
          </p>
          <div className="flex flex-col gap-0.5">

            {/* Settings — desktop only */}
            <div className="hidden md:block">
              <NavItem href="/settings" name="Settings" icon={Settings} isActive={isActive("/settings")} />
              <ReplayTourButton onClick={onClose} />
            </div>

            {/* Profile + Sign Out — mobile only */}
            <div className="md:hidden flex flex-col gap-0.5">
              <NavItem href="/settings" name="Profile" icon={User} isActive={isActive("/settings")} onClick={onClose} />
              <ReplayTourButton onClick={onClose} />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-3 h-10 w-full rounded-[8px] font-mono text-[14px] text-ash hover:text-chalk transition-colors duration-150"
                  style={{ paddingLeft: 12, paddingRight: 12 }}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign Out
                </button>
              </form>
            </div>

          </div>
        </div>

      </div>
    </aside>
  )
}
