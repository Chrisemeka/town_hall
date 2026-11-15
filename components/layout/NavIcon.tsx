"use client"

import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

/**
 * A nav link's icon, which turns into a spinner while that link's navigation
 * is pending, so a click on a slow page is answered at once
 * (docs/perf/DIAGNOSIS-2026-11.md F9). Must render inside the <Link>.
 *
 * The shape changes, not the colour, so state is never colour alone. Hidden
 * from assistive tech: the page's loading.tsx already announces the load.
 * Next skips the pending state for a route already prefetched, so a fast
 * navigation never flashes it.
 */
export function NavIcon({ icon: Icon, className }: { icon: React.ElementType; className: string }) {
  const { pending } = useLinkStatus()
  return pending ? (
    <Loader2 aria-hidden="true" className={`${className} animate-spin motion-reduce:animate-none`} />
  ) : (
    <Icon aria-hidden="true" className={className} />
  )
}
