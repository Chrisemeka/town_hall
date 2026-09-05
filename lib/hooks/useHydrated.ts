"use client"

import { useSyncExternalStore } from "react"

/** The answer never changes after hydration, so there is nothing to notify. */
const neverChanges = () => () => {}
const onClient = () => true
const onServer = () => false

/**
 * False during SSR and the hydration render, true from the first client render
 * onward. Use it to hold back a subtree that cannot render identically on both
 * sides — a portal, a canvas, anything reading the viewport.
 *
 * The usual spelling of this is `useState(false)` plus a mount effect that
 * flips it to true, which is a setState inside an effect: React renders the
 * false branch, commits it, then immediately renders again. Reading it as an
 * external store gets the same answer from the server/client snapshot pair with
 * no second pass, which is why react-hooks/set-state-in-effect objects to the
 * effect version.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(neverChanges, onClient, onServer)
}
