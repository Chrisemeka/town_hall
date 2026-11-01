"use client"

import { TopNav } from "./TopNav"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { TourProvider } from "@/components/tours/TourProvider"
import type { AccountType } from "@/lib/access"
import { navIsActive, type NavBadges } from "@/lib/appNav"

export function AppShell({
  children,
  avatarUrl,
  displayName,
  seenTours,
  account = "builder",
  newMissions = 0,
}: {
  children: React.ReactNode
  avatarUrl?: string | null
  displayName?: string | null
  seenTours?: string[]
  account?: AccountType
  /** Test cases published since the tester last opened Available Test Cases. */
  newMissions?: number
}) {
  // The layout computed the count on its last full render and does not
  // re-render on a soft navigation, so opening the page would leave the badge
  // on screen. Hidden from the moment the pathname arrives there, until a full
  // render brings a fresh count. (React's adjust-state-during-render pattern.)
  const pathname = usePathname()
  const [seen, setSeen] = useState({ count: newMissions, hidden: false })
  if (seen.count !== newMissions) setSeen({ count: newMissions, hidden: false })
  else if (!seen.hidden && newMissions > 0 && navIsActive(pathname, "/explore/missions")) {
    setSeen({ count: newMissions, hidden: true })
  }
  const badges: NavBadges = { newMissions: seen.hidden ? 0 : newMissions }

  return (
    <TourProvider seenTours={seenTours ?? []}>
      <div className="group/shell min-h-dvh bg-surface flex text-ink">
        <TopNav
          avatarUrl={avatarUrl ?? null}
          displayName={displayName ?? null}
          account={account}
        />
        <Sidebar account={account} badges={badges} />

        {/* Bottom padding reserves the bar's height below 840px, so the last
            thing on a page is never under it. */}
        <main className="flex-1 expanded:pl-[240px] pt-[56px] pb-[calc(64px+env(safe-area-inset-bottom))] expanded:pb-0 expanded:max-lg:group-has-[[data-report-bar]]/shell:pb-16 min-h-dvh w-full min-w-0 overflow-x-hidden">
          {children}
        </main>

        <BottomNav account={account} badges={badges} />
      </div>
    </TourProvider>
  )
}
