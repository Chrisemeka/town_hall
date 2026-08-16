"use client"

import { useState } from "react"
import { TopNav } from "./TopNav"
import { Sidebar } from "./Sidebar"
import { TourProvider } from "@/components/tours/TourProvider"
import type { AccountType } from "@/lib/access"

export function AppShell({
  children,
  avatarUrl,
  displayName,
  seenTours,
  account = "builder",
  heldTypes = [],
}: {
  children: React.ReactNode
  avatarUrl?: string | null
  displayName?: string | null
  seenTours?: string[]
  account?: AccountType
  heldTypes?: AccountType[]
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TourProvider seenTours={seenTours ?? []}>
      <div className="min-h-screen bg-obsidian flex text-chalk">
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
          heldTypes={heldTypes}
        />

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 md:pl-[240px] pt-[56px] min-h-screen w-full min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </TourProvider>
  )
}
