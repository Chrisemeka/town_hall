"use client"

import { useEffect, useRef, useState } from "react"
import { errorId } from "@/lib/focus"

/**
 * Cloudflare Turnstile, rendered straight from Cloudflare's script — no wrapper
 * dependency. Supabase validates the token; the secret key lives only in the
 * Supabase dashboard and the app never calls siteverify (SPEC-turnstile §1).
 *
 * Turnstile writes the token into a hidden input it creates in the container.
 * `response-field-name` makes that input `captcha_token`, the schema key, so it
 * rides the form's own FormData to the server action. The container carries
 * the same string as its id, because a hidden input cannot be scrolled to and
 * useFocusFirstError falls back to the id.
 *
 * A token is single-use: Supabase spends it on every call, right or wrong. So
 * the widget resets whenever `resetKey` changes — pass the useActionState
 * result. Miss that and a wrong password followed by the right one fails the
 * second time with a captcha error.
 */

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const FIELD = "captcha_token"
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

let loading: Promise<TurnstileApi> | null = null

/** One script tag per page, however many widgets mount. A failed load is
 *  forgotten so a remount can try again. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject())
    script.onerror = () => {
      loading = null
      script.remove()
      reject()
    }
    document.head.appendChild(script)
  })
  return loading
}

export function Turnstile({
  resetKey,
  errors,
}: {
  resetKey: unknown
  errors?: string[]
}) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [broken, setBroken] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    // Three causes share one message on screen; the console says which.
    if (!siteKey) {
      console.error("[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set in this build")
      return
    }
    let cancelled = false
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !box.current) return
        widget.current = turnstile.render(box.current, {
          sitekey: siteKey,
          // The app's resolved theme, from the attribute app/layout.tsx sets —
          // never "auto", which reads the OS and disagrees with the cookie.
          // ponytail: read once; toggling the theme with the form open leaves
          // the widget in the old one until reload.
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          // Flexible needs 300px; the card's content box is narrower than that
          // on a 360px phone. ponytail: chosen at render, not on resize.
          size: box.current.offsetWidth >= 300 ? "flexible" : "compact",
          "response-field-name": FIELD,
          // A token left sitting goes stale after ~5 minutes; Turnstile fetches
          // a fresh one rather than letting the form submit a dead token.
          "refresh-expired": "auto",
          callback: () => setBroken(false),
          // Codes: developers.cloudflare.com/turnstile/troubleshooting/client-side-errors
          // — 110200 is this hostname missing from the widget's allowlist.
          "error-callback": (code: string) => {
            console.error(`[turnstile] widget error ${code}`)
            setBroken(true)
          },
        })
      },
      () => {
        console.error("[turnstile] script failed to load from challenges.cloudflare.com")
        if (!cancelled) setBroken(true)
      },
    )
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [resetKey])

  const hasError = !!errors?.length
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        id={FIELD}
        tabIndex={-1}
        className="min-h-[64px] focus:outline-none"
        {...(hasError ? { "aria-describedby": errorId(FIELD) } : {})}
      />
      {(broken || !siteKey) && (
        <p role="alert" className="font-mono text-[12px] leading-5 text-danger-ink">
          Verification couldn&apos;t load. Check your connection or turn off
          blockers for this page, then refresh.
        </p>
      )}
      {hasError && (
        <p id={errorId(FIELD)} className="font-mono text-[12px] text-danger-ink">
          {errors[0]}
        </p>
      )}
    </div>
  )
}
