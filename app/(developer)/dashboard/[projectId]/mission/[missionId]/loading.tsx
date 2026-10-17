import { Bar, LoadingAnnounce, StepCardSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx:
 *  the ruled nav bar (a back link and two half-width actions below 600px;
 *  Back, the trail and the actions on one line from 600px), the badge and
 *  title, the chips, the test steps, then the reports. */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-8">
      <LoadingAnnounce label="Loading the mission…" />

      <div aria-hidden="true">
        {/* Nav bar */}
        <div className="flex flex-col gap-3 medium:flex-row medium:items-center medium:justify-between mb-6 pb-4 medium:mb-10 medium:pb-6 border-b border-line">
          <div className="medium:hidden h-12 flex items-center">
            <Bar className="h-4 w-32" />
          </div>
          <div className="hidden medium:flex items-center gap-3">
            <Bar className="h-8 w-20 rounded-[6px]" />
            <Bar className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-2 medium:flex medium:items-center medium:gap-3">
            <Bar className="h-12 lg:h-8 medium:w-32 rounded-[8px]" />
            <Bar className="h-12 lg:h-8 medium:w-32 rounded-[8px]" />
          </div>
        </div>

        {/* Mission header */}
        <div className="mb-8 medium:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Bar className="h-6 w-16 shrink-0" />
            <Bar className="h-9 medium:h-10 expanded:h-11 w-1/2" />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Bar className="h-6 w-24" />
            <Bar className="h-6 w-20" />
          </div>
          <Bar className="h-4 w-24 mt-6 mb-3" />
          <div className="max-w-3xl flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <StepCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Reports */}
        <Bar className="h-40 w-full rounded-[12px]" />
      </div>
    </div>
  )
}
