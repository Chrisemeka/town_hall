import {
  LayoutDashboard, Target, MessageSquare,
  Telescope, Compass, LayoutGrid,
} from "lucide-react"
import type { AccountType } from "@/lib/access"

export type NavLink = {
  name: string
  /** The bottom bar's label: one short word, fits a third of a 360px screen. */
  short: string
  href: string
  icon: React.ElementType
}

// Each account type gets its own nav. There is no combined view — a Builder
// account has no business reaching the tester surfaces and vice versa, and
// middleware would bounce the link anyway. The sidebar (from 840px) and the
// bottom bar (below it) both read this, so they cannot list different places.
export const NAV: Record<AccountType, { heading: string; links: NavLink[] }> = {
  builder: {
    heading: "My Work",
    links: [
      { name: "My Projects",       short: "Projects", href: "/dashboard",          icon: LayoutDashboard },
      { name: "My Missions",       short: "Missions", href: "/dashboard/missions", icon: Target },
      { name: "Feedback Received", short: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
    ],
  },
  tester: {
    heading: "Tester",
    links: [
      { name: "Tester Home",        short: "Home",     href: "/tester",           icon: LayoutGrid },
      { name: "Available Missions", short: "Missions", href: "/explore/missions", icon: Compass },
      { name: "Explore Projects",   short: "Explore",  href: "/explore",          icon: Telescope },
    ],
  },
}

// A parent of another destination matches only itself: /dashboard must not
// light up on /dashboard/missions.
const EXACT_MATCH = new Set(["/dashboard", "/explore", "/tester"])

export function navIsActive(pathname: string, href: string): boolean {
  return EXACT_MATCH.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/")
}
