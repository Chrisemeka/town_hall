import { Bar, LoadingAnnounce, PageHeaderSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/feedback/page.tsx: the header, then
 *  FeedbackListPaged's groups — project and mission title, then each report
 *  as a ruled entry (tester and time, the pass-rate line, "Read full
 *  feedback"). */
export default function Loading() {
  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">
      <LoadingAnnounce label="Loading test reports…" />

      <div aria-hidden="true">
        <PageHeaderSkeleton />
        <div className="flex flex-col gap-8 medium:gap-12">
          {Array.from({ length: 2 }, (_, g) => (
            <div key={g}>
              <div className="mb-4 medium:mb-5 flex flex-col gap-2">
                <Bar className="h-4 w-28" />
                <Bar className="h-6 w-1/2" />
              </div>
              <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="border-l-[3px] border-line pl-4 flex flex-col gap-2">
                    <Bar className="h-4 w-40" />
                    <Bar className="h-5 w-3/5" />
                    <Bar className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
