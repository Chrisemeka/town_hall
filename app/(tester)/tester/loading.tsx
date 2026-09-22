import { Bar, LoadingAnnounce } from "@/components/ui/Skeleton"

/**
 * Mirrors app/(tester)/tester/page.tsx: header and quick actions, the New
 * Missions strip, then the submissions feed alongside the profile panel.
 *
 * The two-column split at the bottom is the shape worth getting right — it is
 * the only asymmetric grid in the app, and a single-column placeholder under it
 * would jump sideways on paint.
 */
export default function Loading() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10 flex flex-col gap-8">
      <LoadingAnnounce label="Loading your tester home…" />

      {/* Header + quick actions */}
      <div
        aria-hidden="true"
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
      >
        <div className="flex flex-col gap-2">
          <Bar className="h-9 w-56 max-w-full" />
          <Bar className="h-5 w-64 max-w-full" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {Array.from({ length: 3 }, (_, i) => (
            <Bar key={i} className="h-10 w-32 rounded-[8px]" />
          ))}
        </div>
      </div>

      {/* New Missions strip */}
      <section aria-hidden="true">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Bar className="h-4 w-32" />
          <Bar className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="bg-surface-raised border border-line rounded-[12px] p-5 flex flex-col gap-4 min-h-[160px]"
            >
              <Bar className="h-6 w-3/4" />
              <Bar className="h-4 w-1/2" />
              <div className="mt-auto flex items-center gap-2">
                <Bar className="h-6 w-20 rounded-[6px]" />
                <Bar className="h-6 w-24 rounded-[6px]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Submissions feed + profile panel */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start"
      >
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="bg-surface-raised border border-line rounded-[12px] p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <Bar className="h-12 w-16 rounded-[8px] shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Bar className="h-5 w-2/3" />
                <Bar className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col gap-4">
          <Bar className="h-6 w-32" />
          <Bar className="h-16 w-full rounded-[8px]" />
          <Bar className="h-5 w-full" />
          <Bar className="h-5 w-4/5" />
        </div>
      </div>
    </div>
  )
}
