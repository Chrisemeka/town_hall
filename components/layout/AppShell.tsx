"use client"

import { useState } from "react"
import { TopNav } from "./TopNav"
import { Sidebar } from "./Sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-obsidian flex text-chalk">
      <TopNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
  )
}
