import { Bar, LoadingAnnounce, ProjectCardSkeleton } from "@/components/ui/Skeleton"

/**
 * Mirrors app/(tester)/explore/page.tsx plus the filter row that ExploreGrid
 * renders above the cards — that row is part of the first paint, so leaving it
 * out would shift the grid down when the real content arrives.
 */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">
      <LoadingAnnounce label="Loading projects…" />

      <div aria-hidden="true">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-2">
          <Bar className="h-9 w-72 max-w-full" />
          <Bar className="h-5 w-48 max-w-full" />
        </div>

        {/* Filter pills + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: 4 }, (_, i) => (
              <Bar key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          <Bar className="h-9 w-full sm:w-[280px] rounded-[8px] shrink-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
