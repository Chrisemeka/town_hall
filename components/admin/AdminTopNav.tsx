"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BugPlay, LogOut, Menu, ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/actions/auth"

const NAV_LINKS = [
  { name: "Dashboard",   href: "/admin" },
  { name: "Users",       href: "/admin/users" },
  { name: "Projects",    href: "/admin/projects" },
  { name: "Missions",    href: "/admin/missions" },
  { name: "Submissions", href: "/admin/submissions" },
  { name: "AI Reports",  href: "/admin/ai-reports" },
  { name: "Email",       href: "/admin/email" },
]

export function AdminTopNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[56px] bg-obsidian border-b border-iron z-50 flex items-center px-4 md:px-6 justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <BugPlay className="w-5 h-5 text-voltage" />
            <span className="font-syne font-bold text-[18px] text-chalk tracking-tight">Twnhall</span>
          </Link>
          <span className="hidden sm:flex items-center gap-1 font-mono text-[10px] uppercase tracking-[1px] text-voltage border border-voltage/40 rounded px-2 py-0.5 shrink-0">
            <ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 h-9 flex items-center rounded-[8px] font-mono text-[13px] transition-colors duration-150",
                isActive(link.href)
                  ? "text-voltage bg-[rgba(232,255,71,0.06)]"
                  : "text-ash hover:text-chalk",
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <form action={signOutAction} className="hidden md:block">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex items-center gap-2 text-ash hover:text-chalk transition-colors duration-150 font-mono text-[13px]"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </form>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 text-ash hover:text-chalk transition-colors duration-150"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-[56px] left-0 right-0 bg-obsidian border-b border-iron z-40 md:hidden">
            <nav className="flex flex-col px-4 py-3 gap-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className={cn(
                    "h-10 px-3 rounded-[8px] font-mono text-[14px] flex items-center transition-colors duration-150",
                    isActive(link.href)
                      ? "text-voltage bg-[rgba(232,255,71,0.06)]"
                      : "text-ash hover:text-chalk",
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <form action={signOutAction} className="mt-2 pt-2 border-t border-iron">
                <button
                  type="submit"
                  className="flex items-center gap-2 h-10 px-3 w-full text-ash hover:text-chalk transition-colors duration-150 font-mono text-[14px]"
                >
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
