"use client"

import Link from "next/link"
import { BugPlay, Search, Bell, User } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { signOutAction } from "@/actions/auth"

export function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-obsidian border-b border-iron z-50 flex items-center px-4 md:px-6 justify-between">
      {/* Left: Logo (takes up the 240px sidebar width area) */}
      <div className="flex items-center w-[240px] shrink-0">
        <Link href="/explore" className="flex items-center gap-2">
          <BugPlay className="w-6 h-6 text-chalk" />
          <span className="font-syne font-bold text-lg text-chalk tracking-tight">Townhall</span>
        </Link>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-[320px] mx-4 hidden md:block relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ash" />
        <Input 
          placeholder="Search projects or missions..." 
          className="pl-9 h-9 border-iron bg-iron/20 text-chalk placeholder:text-ash/70 focus-visible:border-voltage"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/dashboard">New Project</Link>
        </Button>
        <button className="relative p-2 text-ash hover:text-chalk transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-voltage rounded-full border border-obsidian" />
        </button>
        <form action={signOutAction}>
          <button type="submit" className="w-8 h-8 rounded-full bg-iron flex items-center justify-center hover:bg-iron/80 transition-colors border border-[#4A4A5E]">
            <User className="w-4 h-4 text-ash" />
          </button>
        </form>
      </div>
    </header>
  )
}
