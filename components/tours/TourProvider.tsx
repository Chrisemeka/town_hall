"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Onborda, OnbordaProvider, useOnborda } from "onborda"
import { getTours, tourForPath } from "./tours"
import { OnbordaCard } from "./OnbordaCard"
import { markTourSeen } from "@/actions/onboarding"

// Tailwind's `md` breakpoint — below this the desktop nav (and its New Project
// button) is hidden, so mobile tours skip steps that target it.
const MOBILE_BREAKPOINT = 768

// AUTO_START_DELAY: small delay before kicking off a tour on a new page so React
// has time to mount target elements and Onborda can find the selectors.
const AUTO_START_DELAY = 600

function TourOrchestrator({ initialSeenTours }: { initialSeenTours: string[] }) {
  const pathname = usePathname()
  const { startOnborda, isOnbordaVisible, currentTour } = useOnborda()

  // Track tours we've already auto-started this session so we don't loop. We seed
  // from the server-provided list and append client-side as tours complete.
  const seenRef = useRef<Set<string>>(new Set(initialSeenTours))
  const activeTourRef = useRef<string | null>(null)
  const lastVisibleRef = useRef(false)

  // Auto-start on path change if a tour is mapped and not yet seen.
  useEffect(() => {
    const tourName = tourForPath(pathname)
    if (!tourName) return
    if (seenRef.current.has(tourName)) return

    const timer = window.setTimeout(() => {
      if (!seenRef.current.has(tourName)) {
        startOnborda(tourName)
      }
    }, AUTO_START_DELAY)

    return () => window.clearTimeout(timer)
  }, [pathname, startOnborda])

  // Track active tour name while visible so we know which one to mark seen on close.
  useEffect(() => {
    if (isOnbordaVisible && currentTour) {
      activeTourRef.current = currentTour
    }
  }, [isOnbordaVisible, currentTour])

  // Detect transition visible -> hidden and record the tour as seen.
  useEffect(() => {
    const wasVisible = lastVisibleRef.current
    lastVisibleRef.current = isOnbordaVisible

    if (wasVisible && !isOnbordaVisible) {
      const tourName = activeTourRef.current
      if (tourName && !seenRef.current.has(tourName)) {
        seenRef.current.add(tourName)
        // Fire-and-forget; we don't block UI on this.
        markTourSeen(tourName).catch(() => {
          // If the server write fails, remove from local set so the tour can retry.
          seenRef.current.delete(tourName)
        })
      }
      activeTourRef.current = null
    }
  }, [isOnbordaVisible])

  return null
}

export function TourProvider({
  children,
  seenTours,
}: {
  children: React.ReactNode
  seenTours: string[]
}) {
  // OnbordaProvider must wrap everything (server + client) so descendant components
  // can safely call useOnborda. The Onborda visual layer is mounted client-only to
  // avoid SSR + framer-motion hydration noise.
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const steps = useMemo(() => getTours(isMobile), [isMobile])

  return (
    <OnbordaProvider>
      {mounted ? (
        <Onborda
          steps={steps}
          showOnborda={true}
          shadowRgb="14,14,16"
          shadowOpacity="0.85"
          cardComponent={OnbordaCard}
          cardTransition={{ duration: 0.25, type: "tween" }}
        >
          <TourOrchestrator initialSeenTours={seenTours} />
          {children}
        </Onborda>
      ) : (
        children
      )}
    </OnbordaProvider>
  )
}
