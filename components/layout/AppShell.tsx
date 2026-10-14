"use client"

import { useState } from "react"
import { TopNav } from "./TopNav"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { TourProvider } from "@/components/tours/TourProvider"
import type { AccountType } from "@/lib/access"

export function AppShell({
  children,
  avatarUrl,
  displayName,
  seenTours,
  account = "builder",
}: {
  children: React.ReactNode
  avatarUrl?: string | null
  displayName?: string | null
  seenTours?: string[]
  account?: AccountType
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TourProvider seenTours={seenTours ?? []}>
      <div className="group/shell min-h-screen bg-surface flex text-ink">
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          avatarUrl={avatarUrl ?? null}
          displayName={displayName ?? null}
          account={account}
        />
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          account={account}
        />

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            // ponytail: a literal, deliberately. A drawer scrim is dark on
            // both themes — it exists to push the page back, and a scrim
            // that follows the theme stops being one in light mode.
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Bottom padding reserves the bar's height below 840px, so the last
            thing on a page is never under it. */}
        <main className="flex-1 md:pl-[240px] pt-[56px] pb-[calc(64px+env(safe-area-inset-bottom))] expanded:pb-0 min-h-screen w-full min-w-0 overflow-x-hidden">
          {children}
        </main>

        <BottomNav account={account} />
      </div>
    </TourProvider>
  )
}
