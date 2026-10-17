import { Bar, BreadcrumbSkeleton, ListRowSkeleton, LoadingAnnounce } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/[projectId]/page.tsx: the breadcrumb, the
 *  project header (name and badge, URL, summary, Edit beside it from 600px),
 *  then ProjectDetailTabs — the two tabs, + Add Mission in the tab row from
 *  600px, and the Missions panel's rows. */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">
      <LoadingAnnounce label="Loading the project…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton />

        {/* Project header */}
        <div className="flex flex-col medium:flex-row medium:items-start medium:justify-between gap-6 mb-6 medium:mb-10">
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-3 medium:gap-4">
              <Bar className="h-9 medium:h-11 lg:h-[52px] w-2/3 max-w-[480px]" />
              <Bar className="h-6 w-16 shrink-0" />
            </div>
            <Bar className="h-5 w-48" />
            <div className="flex flex-col gap-2 max-w-2xl">
              <Bar className="h-5 w-full" />
              <Bar className="h-5 w-3/5" />
            </div>
          </div>
          <Bar className="h-12 lg:h-9 w-20 rounded-[8px] shrink-0" />
        </div>

        {/* Tabs */}
        <div className="border-b border-line mb-8 flex items-end justify-between">
          <div className="flex flex-1 medium:flex-none items-center medium:gap-6">
            <div className="flex-1 medium:flex-none h-12 lg:h-8 flex items-center justify-center">
              <Bar className="h-5 w-24" />
            </div>
            <div className="flex-1 medium:flex-none h-12 lg:h-8 flex items-center justify-center">
              <Bar className="h-5 w-24" />
            </div>
          </div>
          <Bar className="hidden medium:block h-12 lg:h-9 w-32 mb-3 rounded-[8px]" />
        </div>

        <div className="flex flex-col gap-3 medium:gap-4">
          <Bar className="medium:hidden h-12 w-full rounded-[8px]" />
          {Array.from({ length: 3 }, (_, i) => (
            <ListRowSkeleton key={i} meta={false} />
          ))}
        </div>
      </div>
    </div>
  )
}
