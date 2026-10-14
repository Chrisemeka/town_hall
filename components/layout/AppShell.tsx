"use client"

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
  return (
    <TourProvider seenTours={seenTours ?? []}>
      <div className="group/shell min-h-screen bg-surface flex text-ink">
        <TopNav
          avatarUrl={avatarUrl ?? null}
          displayName={displayName ?? null}
          account={account}
        />
        <Sidebar account={account} />

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
