"use client"

import Link from "next/link"
import { BugPlay, LogOut, User, Menu, X } from "lucide-react"
import { GlobalSearch } from "@/components/GlobalSearch"
import { signOutAction } from "@/actions/auth"

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  avatarUrl,
  displayName,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  avatarUrl?: string | null
  displayName?: string | null
}) {
  const altText = displayName ?? "Your profile"

  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-obsidian border-b border-iron z-50 flex items-center px-4 md:px-6 justify-between">

      {/* Left: Logo */}
      <div className="flex items-center shrink-0 gap-2 md:w-[240px]">
        <Link href="/explore" className="flex items-center gap-2">
          <BugPlay className="w-5 h-5 text-voltage" />
          <span className="font-syne font-bold text-[18px] text-chalk tracking-tight">Townhall</span>
        </Link>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 max-w-[320px] mx-4 md:mx-6">
        <GlobalSearch />
      </div>

      {/* Right: Desktop actions */}
      <div className="hidden md:flex items-center gap-4 shrink-0">
        <Link
          id="tour-new-project-btn"
          href="/dashboard/new"
          className="h-9 px-4 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 flex items-center gap-1.5"
        >
          <span className="text-[16px] leading-none mb-[1px]">+</span>
          New Project
        </Link>

        <Link
          href="/settings"
          aria-label="Settings"
          title={displayName ?? "Settings"}
          className="w-8 h-8 rounded-full bg-graphite border border-iron flex items-center justify-center overflow-hidden hover:border-voltage transition-colors duration-150"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={altText}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-ash" />
          )}
        </Link>

        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="p-2 text-ash hover:text-chalk transition-colors duration-150 flex items-center justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Right: Mobile hamburger */}
      <button
        className="md:hidden p-2 text-ash hover:text-chalk transition-colors duration-150"
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

    </header>
  )
}
