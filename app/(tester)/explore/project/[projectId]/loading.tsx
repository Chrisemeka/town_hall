import { Bar, BreadcrumbSkeleton, LoadingAnnounce } from "@/components/ui/Skeleton"

/** Mirrors app/(tester)/explore/project/[projectId]/page.tsx, which is not
 *  revamped yet — its container and trail are copied as they are: the
 *  breadcrumb, the project card, the Missions heading and count, then the
 *  numbered mission rows. */
export default function Loading() {
  return (
    <div className="max-w-[800px] mx-auto px-6 md:px-8 py-10">
      <LoadingAnnounce label="Loading the project's test cases…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton compactBack={false} />

        <div className="bg-surface-raised border border-line rounded-[12px] p-6 mb-10 flex flex-col gap-2">
          <Bar className="h-[34px] w-1/2" />
          <Bar className="h-5 w-48" />
          <Bar className="h-5 w-full mt-2" />
          <Bar className="h-5 w-3/5" />
        </div>

        <div className="mb-5 flex flex-col gap-1">
          <Bar className="h-7 w-28" />
          <Bar className="h-4 w-36" />
        </div>

        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="bg-surface-raised border border-line rounded-[12px] px-6 py-5 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Bar className="h-4 w-8" />
                <Bar className="h-6 w-2/3" />
              </div>
              <Bar className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
