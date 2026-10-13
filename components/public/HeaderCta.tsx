"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/** Where the form's submit is the page's Voltage fill, so the header has none. */
export const AUTH_ROUTES = ["/signup", "/login", "/forgot-password", "/reset-password", "/confirm-email"]

/** By path segment: /login/x is an auth route, /loginx is not. */
export function showsGetStarted(pathname: string): boolean {
  return !AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

/**
 * The header's "Get started": the one Voltage fill per viewport (Design.md
 * §7.2), always with Obsidian text on it, never accent ink on a light ground.
 * A client component only for usePathname; the header stays a server
 * component. Absent on the auth routes, where the form's submit is the fill
 * and on /signup this would link to itself.
 *
 * Below lg it draws at 40px, and the ::after (5px over, so 48.5px after the
 * scale) keeps the tap area at 48px (SPEC-m3-foundations §3.4). Scaled 97%
 * from its right edge and pulled 4px (8px on medium) toward the menu button.
 */
export function HeaderCta() {
  if (!showsGetStarted(usePathname())) return null
  return (
    <Link
      href="/signup"
      className="max-lg:relative max-lg:scale-[0.97] max-lg:origin-right max-medium:-mr-1 medium:max-expanded:-mr-2 shrink-0 h-10 lg:h-11 px-3 lg:px-4 inline-flex items-center bg-accent text-obsidian rounded-[8px] font-mono font-medium text-[13px] lg:text-[14px] max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:-inset-y-[5px] hover:bg-voltage-dark transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      Get started
    </Link>
  )
}
