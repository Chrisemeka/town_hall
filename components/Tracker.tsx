"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * One beacon per route change to /api/track — first-party page views, no
 * third-party script. JS-only on purpose: most crawlers never run it.
 *
 * The referrer goes with the first view only. On a client-side navigation
 * document.referrer still names the site the visit came from, and sending it
 * again would credit every later page to it.
 */
export function Tracker() {
  const pathname = usePathname()
  const first = useRef(true)

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return
    const query = new URLSearchParams(window.location.search)
    const body = JSON.stringify({
      path: pathname,
      referrer: first.current ? document.referrer || null : null,
      utm_source: query.get("utm_source"),
      utm_medium: query.get("utm_medium"),
      utm_campaign: query.get("utm_campaign"),
    })
    first.current = false
    try {
      if (!navigator.sendBeacon?.("/api/track", body)) {
        void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {})
      }
    } catch {
      // Analytics never breaks a page.
    }
  }, [pathname])

  return null
}
