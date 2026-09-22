/**
 * Skeleton primitives for the route-level `loading.tsx` files.
 *
 * Design.md does not specify a skeleton treatment — §8 covers empty states,
 * which are a different thing: an empty state is a terminal answer ("Nothing
 * here yet"), a skeleton is a placeholder for content that is on its way. These
 * derive their look from the §5.3 card instead — graphite surface, iron border,
 * 12px radius — with iron bars standing in for text at the real line heights,
 * so the skeleton and the content it replaces occupy the same space.
 *
 * Skeletons are decorative by definition. The tree is `aria-hidden` at each call
 * site and the route announces itself once through `LoadingAnnounce`, so a
 * screen reader gets one sentence rather than a bag of empty boxes.
 */

/** A single placeholder line. Caller sets the height and width. */
export function Bar({ className }: { className: string }) {
  return <div className={`bg-line rounded-[4px] ${className}`} />
}

/**
 * The project card shared by /dashboard and /explore — both render the same
 * shape into the same `grid-cols-1 md:grid-cols-2 gap-6`.
 */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col gap-4">
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-4">
        <Bar className="h-7 w-1/2" />
        <Bar className="h-5 w-20" />
      </div>
      {/* Description, two lines */}
      <div className="flex flex-col gap-2">
        <Bar className="h-5 w-full" />
        <Bar className="h-5 w-4/5" />
      </div>
      {/* URL */}
      <Bar className="h-4 w-2/5" />
      {/* Footer counts + action */}
      <div className="pt-4 border-t border-line flex items-center justify-between gap-4">
        <Bar className="h-4 w-32" />
        <Bar className="h-4 w-16" />
      </div>
    </div>
  )
}

/**
 * The one thing assistive tech is told while a route loads.
 *
 * Separate from the skeleton so the announcement says what is arriving rather
 * than describing the placeholder.
 */
export function LoadingAnnounce({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  )
}
