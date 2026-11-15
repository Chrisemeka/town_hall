"use client"

import { TopNav } from "./TopNav"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { Suspense, use, useEffect, useState } from "react"
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
  newMissions,
}: {
  children: React.ReactNode
  avatarUrl?: string | null
  displayName?: string | null
  seenTours?: string[]
  account?: AccountType
  /**
   * Test cases published since the tester last opened Available Test Cases.
   * A promise, so the count streams in after the shell instead of holding
   * every tester page until its reads finish (docs/perf/DIAGNOSIS-2026-11.md
   * F5). newMissionCount() never rejects.
   */
  newMissions?: Promise<number>
}) {
  // The layout computed the count on its last full render and does not
  // re-render on a soft navigation, so opening the page would leave the badge
  // on screen. Hidden from the moment the pathname arrives there, until a full
  // render brings a fresh count. (React's adjust-state-during-render pattern.)
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  const [seen, setSeen] = useState({ count, hidden: false })
  if (seen.count !== count) setSeen({ count, hidden: false })
  else if (!seen.hidden && count > 0 && navIsActive(pathname, "/explore/missions")) {
    setSeen({ count, hidden: true })
  }
  const badges: NavBadges = { newMissions: seen.hidden ? 0 : count }

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
        {newMissions && (
          <Suspense fallback={null}>
            <CountFrom promise={newMissions} onCount={setCount} />
          </Suspense>
        )}
      </div>
    </TourProvider>
  )
}

/** Resolves the streamed badge count into the shell's state. Renders nothing. */
function CountFrom({ promise, onCount }: { promise: Promise<number>; onCount: (n: number) => void }) {
  const n = use(promise)
  useEffect(() => onCount(n), [n, onCount])
  return null
}
