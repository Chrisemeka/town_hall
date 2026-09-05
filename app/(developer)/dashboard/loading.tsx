import { Bar, LoadingAnnounce, ProjectCardSkeleton } from "@/components/ui/Skeleton"

/** Mirrors the layout of app/(developer)/dashboard/page.tsx. */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">
      <LoadingAnnounce label="Loading your projects…" />

      <div aria-hidden="true">
        {/* Page header — heading, subtitle, New Project button */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <Bar className="h-9 w-64 max-w-full" />
            <Bar className="h-5 w-80 max-w-full" />
          </div>
          <Bar className="h-10 w-36 rounded-[8px] shrink-0" />
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
