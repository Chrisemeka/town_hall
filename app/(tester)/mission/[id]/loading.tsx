import { Bar, BreadcrumbSkeleton, LoadingAnnounce, StepCardSkeleton } from "@/components/ui/Skeleton"

/**
 * Mirrors app/(tester)/mission/[id]/page.tsx: the breadcrumb, MissionBrief
 * (title, the project card, chips, the test steps), then AuditLogForm's first
 * paint — the Open Project button and its one-line hint.
 *
 * Deliberately not the audit-log steps or the sticky progress bar: both mount
 * only after the tester presses Open Project (`unlocked`), so a skeleton that
 * drew them would show a bar the loaded page does not have, then take it away.
 */
export default function Loading() {
  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-10 expanded:py-10">
      <LoadingAnnounce label="Loading the mission…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton />

        {/* MissionBrief */}
        <Bar className="h-9 medium:h-10 lg:h-11 w-2/3 mb-4 medium:mb-6" />
        <div className="mb-8 border border-line bg-surface-raised rounded-[12px] px-4 py-4 medium:px-6 medium:py-5 flex flex-col gap-2">
          <Bar className="h-6 w-40" />
          <Bar className="h-5 w-48" />
          <Bar className="h-5 w-full" />
        </div>
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Bar className="h-6 w-24" />
            <Bar className="h-6 w-20" />
          </div>
          <Bar className="h-4 w-24 mt-6 mb-3" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <StepCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* AuditLogForm before Open Project */}
        <Bar className="h-12 w-full rounded-[8px] mb-3" />
        <Bar className="h-5 w-3/4 mb-8" />
      </div>
    </div>
  )
}
