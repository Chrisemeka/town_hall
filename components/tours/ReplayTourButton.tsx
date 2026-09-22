"use client"

import { usePathname } from "next/navigation"
import { useOnborda } from "onborda"
import { HelpCircle } from "lucide-react"
import { tourForPath } from "./tours"
import { cn } from "@/lib/utils"

export function ReplayTourButton({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname()
  const { startOnborda } = useOnborda()

  const tourName = tourForPath(pathname)
  const hasTour = !!tourName

  function handleClick() {
    if (tourName) startOnborda(tourName)
    onClick?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasTour}
      title={hasTour ? "Replay the tour for this page" : "No tour available for this page"}
      className={cn(
        "flex items-center gap-3 h-10 w-full rounded-[8px] font-mono text-[14px] transition-colors duration-150 px-3 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        hasTour
          ? "text-ink-muted hover:text-ink cursor-pointer"
          : "text-ink-muted/40 cursor-not-allowed",
      )}
    >
      <HelpCircle className="w-4 h-4 shrink-0" />
      Replay page tour
    </button>
  )
}
