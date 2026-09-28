import { SetupShell } from "@/components/setup/SetupShell"
import { Bar, LoadingAnnounce } from "@/components/ui/Skeleton"

/**
 * Paints the moment /choose-account redirects here, instead of holding the old
 * page — on a phone, the held page is what read as "hung".
 *
 * The real shell, not a lookalike, so the header does not jump on paint. The
 * body mirrors the identity step: a heading, then a stack of labelled fields.
 */
export default function Loading() {
  return (
    <SetupShell context="Setting up your account">
      <LoadingAnnounce label="Loading your profile form…" />
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Bar className="h-8 w-64 max-w-full" />
          <Bar className="h-5 w-80 max-w-full" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bar className="h-4 w-24" />
            <Bar className="h-12 w-full rounded-[8px]" />
          </div>
        ))}
      </div>
    </SetupShell>
  )
}
