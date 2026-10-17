import { BreadcrumbSkeleton, LoadingAnnounce, MissionFormSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/[projectId]/mission/[missionId]/edit/page.tsx,
 *  which is not revamped yet: its container and the trail at every width are
 *  copied as they are. EditMissionForm is carded throughout. */
export default function Loading() {
  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">
      <LoadingAnnounce label="Loading the form…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton compactBack={false} />
        <MissionFormSkeleton framed="always" />
      </div>
    </div>
  )
}
