"use client"

import { useEffect } from "react"
import { markMissionsSeen } from "@/actions/notifications"

/**
 * Clears the new-test-case counter once Available Test Cases is actually on
 * screen. On mount, never in the server render: a prefetch renders routes
 * nobody opened. The shell has already hidden the badge locally; this makes
 * it stay gone on the next full render. Renders nothing.
 */
export function MarkMissionsSeen({ renderedAt }: { renderedAt: string }) {
  useEffect(() => {
    markMissionsSeen(renderedAt).catch(() => {
      // Worst case the badge comes back on the next full render.
    })
  }, [renderedAt])
  return null
}
