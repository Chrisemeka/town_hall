"use client"

import Link from "next/link"
import { Avatar } from "@/components/ui/Avatar"
import { Plus } from "lucide-react"
import { Logo } from "@/components/Logo"
import { GlobalSearch } from "@/components/GlobalSearch"
import { homeFor, type AccountType } from "@/lib/access"
import { AccountSheet } from "./AccountSheet"

// A builder's primary action, in the bar on every builder page. Testers get
// none here: Tester Home carries its own Browse Missions button, and a second
// Voltage CTA in the same view breaks Design.md's one-per-viewport rule.
const BUILDER_CTA = { href: "/dashboard/new", label: "New Project" }

export function TopNav({
  avatarUrl,
  displayName,
  account = "builder",
}: {
  avatarUrl?: string | null
  displayName?: string | null
  account?: AccountType
}) {
  const cta = account === "builder" ? BUILDER_CTA : null

  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-surface border-b border-line z-50 flex items-center px-4 medium:px-6 justify-between">

      {/* Left: Logo */}
      {/* Below 600px the mark carries the brand and the wordmark is for
          screen readers only: the search needs the width. */}
      <div className="flex items-center shrink-0 gap-2 expanded:w-[240px]">
        <Link href={homeFor(account)} className="min-h-12 min-w-12 lg:min-h-0 lg:min-w-0 flex items-center gap-2">
          <Logo size={40} onDark />
          <span className="sr-only medium:not-sr-only font-syne font-bold text-[18px] text-ink tracking-tight">Twnhall</span>
        </Link>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 min-w-0 max-w-[320px] mx-2 medium:mx-4 expanded:mx-6">
        <GlobalSearch account={account} />
      </div>

      {/* Right: Desktop actions */}
      <div className="hidden expanded:flex items-center gap-4 shrink-0">
        {cta && (
          <Link
            id="tour-new-project-btn"
            href={cta.href}
            className="h-9 px-4 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {cta.label}
          </Link>
        )}

        <Link
          href="/settings"
          aria-label="Settings"
          title={displayName ?? "Settings"}
          className="rounded-full hover:opacity-80 transition-opacity duration-150"
        >
          {/* Initials rather than a generic person icon: this was the one
              avatar surface that did not identify who it belonged to, which
              matters now that every email/password user has a null
              avatar_url. */}
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={32}
            className="hover:border-accent-ink transition-colors duration-150"
          />
        </Link>

      </div>

      {/* Right: Mobile actions */}
      <div className="flex expanded:hidden items-center gap-2 shrink-0">
        {cta && (
          <Link
            id="tour-new-project-btn-mobile"
            href={cta.href}
            aria-label={cta.label}
            className="w-12 h-12 rounded-full bg-voltage text-obsidian flex items-center justify-center hover:bg-voltage-dark transition-colors duration-150"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
          </Link>
        )}

        {/* Destinations are in the bottom bar; the avatar opens the rest. */}
        <AccountSheet avatarUrl={avatarUrl ?? null} displayName={displayName ?? null} account={account} />
      </div>

    </header>
  )
}
