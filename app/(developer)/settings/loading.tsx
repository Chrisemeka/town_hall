import { Bar, FormFieldSkeleton, LoadingAnnounce, PageHeaderSkeleton } from "@/components/ui/Skeleton"

/** Mirrors app/(developer)/settings/page.tsx: the header, SettingsTabs' strip
 *  (equal cells below 600px, content-width from it), then the first tab's
 *  first SettingsSection — heading, line, and its fields. Shared by both
 *  roles, so the strip shows the builder's four cells; a tester's three are
 *  the same height, which is what keeps the section from moving. */
export default function Loading() {
  return (
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">
      <LoadingAnnounce label="Loading settings…" />

      <div aria-hidden="true">
        <PageHeaderSkeleton />

        <div className="flex medium:gap-1 border-b border-line">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex-1 medium:flex-none medium:px-4 h-12 lg:h-11 flex items-center justify-center">
              <Bar className="h-4 w-14" />
            </div>
          ))}
        </div>

        <div className="pt-6 medium:pt-8">
          <div className="rounded-[12px] border border-line bg-surface-raised p-5 medium:p-8">
            <Bar className="h-7 w-32" />
            <Bar className="h-6 w-3/4 mt-2" />
            <div className="mt-6 flex flex-col gap-5">
              {Array.from({ length: 3 }, (_, i) => (
                <FormFieldSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
