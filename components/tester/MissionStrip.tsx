import Link from "next/link"
import { Clock, Compass, Users } from "lucide-react"

export type StripMission = {
  id: string
  title: string
  projectName: string
  category: string | null
  isNew: boolean
  loadTestAt: string | null
  testersNeeded: number | null
  createdAt: string
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function loadTestWindow(iso: string): string {
  const at = new Date(iso)
  const today = new Date()
  const sameDay = at.toDateString() === today.toDateString()
  const time = at.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
  const day = sameDay
    ? "TODAY"
    : at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase()
  return `${day} ${time} UTC`
}

export function MissionStrip({ missions }: { missions: StripMission[] }) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-line rounded-[12px] text-center px-6">
        <Compass className="w-10 h-10 text-ink-muted mb-3 opacity-40" />
        <p className="font-syne font-bold text-[18px] text-ink mb-1">No open missions right now.</p>
        <p className="font-mono text-[13px] text-ink-muted">
          New missions land here as builders publish them.
        </p>
      </div>
    )
  }

  // Below 600px a swipeable row, M3's multi-browse carousel: six cards
  // stacked were ~1,000px of scroll before the tester's own submissions.
  // Each card is 85% wide so the next one's edge shows. From 600px the grid.
  // role="list" because Safari drops list semantics from a styled <ul>, and
  // "list, 6 items" is what tells a screen reader there is more to swipe to.
  return (
    <ul
      role="list"
      className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden medium:grid medium:grid-cols-2 medium:gap-4 medium:overflow-visible medium:mx-0 medium:px-0 lg:grid-cols-3"
    >
      {missions.map((m) => {
        // A load test is a scheduled, real-human, coordinated window — kept
        // visually distinct from open-ended missions on purpose. It is not the
        // same thing as the simulated load-test parameters elsewhere.
        const isLoadTest = m.loadTestAt !== null

        return (
          <li key={m.id} className="w-[85%] shrink-0 snap-start medium:w-auto">
          <Link
            href={`/mission/${m.id}`}
            className="group block h-full"
          >
            <div
              className={[
                "bg-surface-raised border rounded-[12px] p-5 flex flex-col gap-3.5 h-full min-h-[160px] shadow-card transition-colors duration-150 group-active:border-accent-ink",
                isLoadTest
                  ? "border-info-ink/40 group-hover:border-info-ink"
                  : "border-line group-hover:border-accent-ink/30",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {m.isNew && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent-ink"
                      title="Posted in the last 24 hours"
                      aria-hidden="true"
                    />
                  )}
                  <span className="font-syne font-bold text-[16px] text-ink truncate group-hover:text-accent-ink transition-colors duration-150">
                    {/* The dot's meaning, said: an aria-label on a bare span
                        was never announced. */}
                    {m.isNew && <span className="sr-only">New, </span>}
                    {m.projectName}
                  </span>
                </div>
              </div>

              <p className="font-mono text-[13px] leading-5 text-ink-muted line-clamp-2">
                {m.title}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {m.category && (
                  <span className="font-mono text-[12px] lg:text-[11px] tracking-[0.5px] text-ink/80 border border-line bg-surface px-2.5 py-1 rounded-[6px]">
                    {m.category}
                  </span>
                )}
                {isLoadTest && (
                  <span className="font-mono text-[12px] lg:text-[11px] tracking-[0.5px] text-info-ink border border-info-ink/30 bg-sky/10 px-2.5 py-1 rounded-[6px] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {loadTestWindow(m.loadTestAt!)}
                  </span>
                )}
              </div>

              <div className="mt-auto pt-1 flex items-center justify-between font-mono text-[12px] text-ink-muted">
                <span className="flex items-center gap-1.5 truncate">
                  Posted {timeAgo(m.createdAt)}
                  {isLoadTest && m.testersNeeded ? (
                    <>
                      <span aria-hidden="true" className="text-ink-muted">·</span>
                      <Users className="w-3 h-3 shrink-0" />
                      {m.testersNeeded} needed
                    </>
                  ) : null}
                </span>
                <span className="text-ink/70 group-hover:text-ink transition-colors duration-150 shrink-0">
                  View →
                </span>
              </div>
            </div>
          </Link>
          </li>
        )
      })}
    </ul>
  )
}
