import { ListRowSkeleton, LoadingAnnounce, PageHeaderSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/missions/page.tsx: the header with + Add
 *  Mission, then MissionListPaged's row cards — project name above the title,
 *  the count and status badge beside it from 600px. */
export default function Loading() {
  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">
      <LoadingAnnounce label="Loading your missions…" />

      <div aria-hidden="true">
        <PageHeaderSkeleton action />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <ListRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
