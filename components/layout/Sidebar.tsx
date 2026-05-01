"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Target, MessageSquare, Telescope, Compass, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const MY_WORK_LINKS = [
  { name: "My Projects", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Missions", href: "/dashboard/missions", icon: Target },
  { name: "Feedback Received", href: "/dashboard/feedback", icon: MessageSquare },
]

const COMMUNITY_LINKS = [
  { name: "Explore Projects", href: "/explore", icon: Telescope },
  { name: "Browse Missions", href: "/explore/missions", icon: Compass },
  { name: "Recent Activity", href: "/explore/activity", icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 w-[240px] bg-obsidian border-r border-iron flex flex-col z-40 font-mono pt-[56px]">
      {/* Spacer for Top Nav (if we want the logo in the sidebar, but design says logo is in top nav.
          Wait, usually if sidebar is full height, logo is in sidebar. Design says Top Nav has "Left: Logo + Townhall wordmark".
          So sidebar starts below top nav? Or sidebar is full height?
          "Sidebar: Width: 240px, Background: #0E0E10, border-right: 1px solid #2C2C35"
          Let's make Sidebar full height, but push its content down by 56px, or just put the logo in the sidebar.
          If Top Nav is left-[240px], then logo is in top nav but starts at 240px? No, "Left: Logo".
          If logo is in top nav, maybe sidebar starts below top nav (top-[56px]). Let's assume sidebar starts below Top Nav. */}
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-8">
        
        {/* MY WORK */}
        <div>
          <h3 className="text-xs font-semibold text-ash mb-4 px-2 tracking-wider">MY WORK</h3>
          <div className="flex flex-col gap-1">
            {MY_WORK_LINKS.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-iron text-chalk font-medium"
                      : "text-ash hover:bg-iron/50 hover:text-chalk"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.name}
                </Link>
              )
            })}
          </div>
        </div>

        {/* COMMUNITY */}
        <div>
          <h3 className="text-xs font-semibold text-ash mb-4 px-2 tracking-wider">COMMUNITY</h3>
          <div className="flex flex-col gap-1">
            {COMMUNITY_LINKS.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-iron text-chalk font-medium"
                      : "text-ash hover:bg-iron/50 hover:text-chalk"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.name}
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </aside>
  )
}
