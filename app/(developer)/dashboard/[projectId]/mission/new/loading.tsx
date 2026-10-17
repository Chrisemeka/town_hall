import { BreadcrumbSkeleton, LoadingAnnounce, MissionFormSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/[projectId]/mission/new/page.tsx: the
 *  breadcrumb, then AddMissionForm — carded from 600px. */
export default function Loading() {
  return (
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-10 expanded:py-10">
      <LoadingAnnounce label="Loading the form…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton />
        <MissionFormSkeleton framed="medium" />
      </div>
    </div>
  )
}
