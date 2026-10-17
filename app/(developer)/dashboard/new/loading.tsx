import { BreadcrumbSkeleton, LoadingAnnounce, ProjectFormSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/dashboard/new/page.tsx: the breadcrumb, then
 *  CreateProjectForm — carded from 600px, on the page below it. */
export default function Loading() {
  return (
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-10 expanded:py-10">
      <LoadingAnnounce label="Loading the form…" />

      <div aria-hidden="true">
        <BreadcrumbSkeleton />
        <ProjectFormSkeleton framed="medium" />
      </div>
    </div>
  )
}
