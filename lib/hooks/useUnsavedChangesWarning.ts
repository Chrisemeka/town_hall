"use client"

import { useEffect } from "react"

/**
 * Warn the user before they reload or close the tab while they have
 * unsaved form input. Pass `true` while the form is dirty; the hook
 * removes the listener as soon as it flips back to `false` (e.g. after
 * a successful submit) so navigation isn't blocked unnecessarily.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    function handler(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])
}
