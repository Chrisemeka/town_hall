import { Bar, ListRowSkeleton, LoadingAnnounce, PageHeaderSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(tester)/explore/missions/page.tsx: the header, BrowseMissions'
 *  search field (full width below 600px, 280px from it — no filter pills on
 *  this page), then its mission rows: number and meta, title, chips. Not
 *  Explore's project cards, which this page used to inherit. */
export default function Loading() {
  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">
      <LoadingAnnounce label="Loading test cases…" />

      <div aria-hidden="true">
        <PageHeaderSkeleton />
        <Bar className="h-12 lg:h-9 w-full medium:w-[280px] mb-6 medium:mb-8 rounded-[8px]" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <ListRowSkeleton key={i} chips />
          ))}
        </div>
      </div>
    </div>
  )
}
