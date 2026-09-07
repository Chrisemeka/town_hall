"use client"

import { useCallback, useRef } from "react"
import { focusFirstError, type FocusFirstErrorOptions } from "@/lib/focus"

/**
 * Returns a callback that carries the user to the first field in error.
 *
 * Call it with the same fieldErrors object the form already renders: in the
 * submit handler when a client-side parse fails, and in an effect on the
 * useActionState result when the failure came back from the server. Forms with
 * both paths call it from both.
 *
 * See lib/focus.ts for why this is a callback rather than an effect watching a
 * value, and for what it does once it has the errors.
 */
export function useFocusFirstError(
  options: FocusFirstErrorOptions = {},
): (fieldErrors: Record<string, unknown>) => void {
  // Held in a ref so a caller can pass an inline object literal without the
  // returned callback changing identity on every render.
  const latest = useRef(options)
  latest.current = options

  return useCallback((fieldErrors: Record<string, unknown>) => {
    focusFirstError(fieldErrors, latest.current)
  }, [])
}
