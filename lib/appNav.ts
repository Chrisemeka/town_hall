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

/** Segment-wise prefix: /dashboard owns /dashboard/x, never /dashboardx. */
export function navIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/*
 * Routes outside every nav href's URL tree, mapped to the first link of the
 * page's own breadcrumb, so the nav and the breadcrumb never disagree. Change
 * one, change the other.
 */
const NAV_ALIASES: Record<AccountType, { prefix: string; href: string }[]> = {
  builder: [],
  // /mission/[id]: "Explore › project › mission".
  tester: [{ prefix: "/mission", href: "/explore" }],
}

/**
 * The one nav href that owns this pathname, or null: the longest href that is
 * a segment-wise prefix of it. /dashboard/missions goes to My Missions because
 * that href is longer than /dashboard; /dashboard/new and everything under a
 * project fall to My Projects. One rule, so at most one item is ever active —
 * the exact-match list it replaces switched the parent off on every subpage.
 */
export function activeNavHref(pathname: string, account: AccountType): string | null {
  let best: string | null = null
  for (const { href } of NAV[account].links) {
    if (navIsActive(pathname, href) && href.length > (best?.length ?? -1)) best = href
  }
  return best ?? NAV_ALIASES[account].find((a) => navIsActive(pathname, a.prefix))?.href ?? null
}

/**
 * aria-current for an active nav link: "page" on the destination itself,
 * "true" on a page it owns — /dashboard/new is My Projects' territory, not
 * the My Projects page, and a screen reader should hear the difference.
 */
export function navCurrent(pathname: string, href: string): "page" | "true" {
  return pathname === href ? "page" : "true"
}

/**
 * Form routes carry their own primary action; the top bar's "+ New Project"
 * steps aside.
 * On /dashboard/new it linked to the page you were on, and on every form it
 * was a second Voltage fill beside the submit, and an exit mid-form.
 */
export function showsNewProject(pathname: string): boolean {
  return !(
    pathname === "/dashboard/new" ||
    /^\/dashboard\/[^/]+\/(edit|mission\/new|mission\/[^/]+\/edit)$/.test(pathname)
  )
}
