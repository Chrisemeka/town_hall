import { BreadcrumbSkeleton, LoadingAnnounce, ProjectFormSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/[projectId]/edit/page.tsx, which is not
 *  revamped yet: its container and the trail at every width are copied as
 *  they are, so nothing moves on paint. EditProjectForm is carded throughout. */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">
      <LoadingAnnounce label="Loading the form…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton compactBack={false} />
        <div className="max-w-2xl mx-auto">
          <ProjectFormSkeleton framed="always" />
        </div>
      </div>
    </div>
  )
}
