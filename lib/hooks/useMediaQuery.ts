"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Whether a CSS media query currently matches.
 *
 * matchMedia is mutable state that lives outside React, which is exactly what
 * useSyncExternalStore is for — subscribing to it through a mount effect that
 * seeds state would render once with the wrong answer and then correct it.
 *
 * Returns false on the server. There is no viewport to measure there, and a
 * guess would only hydrate into a mismatch; callers that must not render a
 * desktop layout to a phone should gate on [[useHydrated]] as well.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
