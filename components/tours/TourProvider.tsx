"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
// The context alone, never the "onborda" entry: that re-exports the overlay,
// and the overlay pulls framer-motion (~39 kB gz) into every app page.
import { OnbordaProvider, useOnborda } from "onborda/dist/OnbordaContext"
import { getTours, tourForPath } from "./tours"
import { OnbordaCard } from "./OnbordaCard"
import { markTourSeen } from "@/actions/onboarding"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"

// The expanded size class: below it the labelled New Project button is
// hidden and the round + is the visible one, so mobile tours point at that.
const MOBILE_BREAKPOINT = 840

// AUTO_START_DELAY: small delay before kicking off a tour on a new page so React
// has time to mount target elements and Onborda can find the selectors.
const AUTO_START_DELAY = 600

// Loaded only once a tour is about to show (docs/perf/DIAGNOSIS-2026-11.md F6).
// Client-only, which also replaces the old mounted check.
const Onborda = dynamic(() => import("onborda/dist/Onborda"), { ssr: false })

function TourOrchestrator({ initialSeenTours, onWant }: { initialSeenTours: string[]; onWant: () => void }) {
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
    // Start fetching the overlay now; the delay below covers most of it.
    onWant()

    const timer = window.setTimeout(() => {
      if (!seenRef.current.has(tourName)) {
        startOnborda(tourName)
      }
    }, AUTO_START_DELAY)

    return () => window.clearTimeout(timer)
  }, [pathname, startOnborda, onWant])

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
  // can safely call useOnborda. The overlay sits beside the page, not around it:
  // it draws through a portal and finds its targets by selector, and wrapping
  // the page in it remounted the whole tree once it loaded.
  return (
    <OnbordaProvider>
      {children}
      <TourLayer seenTours={seenTours} />
    </OnbordaProvider>
  )
}

/**
 * Mounts the overlay only when a tour wants it: an unseen tour for this page,
 * or the replay button. A returning user who has seen every tour never
 * downloads it.
 */
function TourLayer({ seenTours }: { seenTours: string[] }) {
  const { isOnbordaVisible } = useOnborda()
  const [wanted, setWanted] = useState(false)
  const want = useCallback(() => setWanted(true), [])
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  const steps = useMemo(() => getTours(isMobile), [isMobile])

  return (
    <>
      <TourOrchestrator initialSeenTours={seenTours} onWant={want} />
      {(wanted || isOnbordaVisible) && (
        <Onborda
          steps={steps}
          showOnborda={true}
          // ponytail: a literal, deliberately. The tour overlay is a scrim —
          // it exists to push the page back so one element stands out, and a
          // scrim that follows the theme stops being one in light mode.
          shadowRgb="14,14,16"
          shadowOpacity="0.85"
          cardComponent={OnbordaCard}
          cardTransition={{ duration: 0.25, type: "tween" }}
        >
          {null}
        </Onborda>
      )}
    </>
  )
}
