import Link from "next/link"
import { Clock, Compass, Users } from "lucide-react"
import { formatMoney } from "@/lib/tester"

export type StripMission = {
  id: string
  title: string
  projectName: string
  category: string | null
  payoutCents: number
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
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-iron rounded-[12px] text-center px-6">
        <Compass className="w-10 h-10 text-ash mb-3 opacity-40" />
        <p className="font-syne font-bold text-[18px] text-chalk mb-1">No open missions right now.</p>
        <p className="font-mono text-[13px] text-ash">
          New missions land here as builders publish them.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {missions.map((m) => {
        // A load test is a scheduled, real-human, coordinated window — kept
        // visually distinct from open-ended missions on purpose. It is not the
        // same thing as the simulated load-test parameters elsewhere.
        const isLoadTest = m.loadTestAt !== null

        return (
          <Link
            key={m.id}
            href={`/mission/${m.id}`}
            className="group block"
          >
            <div
              className={[
                "bg-graphite border rounded-[12px] p-5 flex flex-col gap-3.5 h-full min-h-[160px] transition-colors duration-150",
                isLoadTest
                  ? "border-sky/40 group-hover:border-sky"
                  : "border-iron group-hover:border-voltage/30",
              ].join(" ")}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {m.isNew && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 bg-voltage"
                      title="Posted in the last 24 hours"
                      aria-label="New"
                    />
                  )}
                  <span className="font-syne font-bold text-[16px] text-chalk truncate group-hover:text-voltage transition-colors duration-150">
                    {m.projectName}
                  </span>
                </div>
                {m.payoutCents > 0 && (
                  <span className="font-mono font-bold text-[16px] text-voltage shrink-0">
                    {formatMoney(m.payoutCents)}
                  </span>
                )}
              </div>

              <p className="font-mono text-[13px] leading-5 text-ash line-clamp-2">
                {m.title}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {m.category && (
                  <span className="font-mono text-[11px] tracking-[0.5px] text-chalk/80 border border-iron bg-obsidian px-2.5 py-1 rounded-[6px]">
                    {m.category}
                  </span>
                )}
                {isLoadTest && (
                  <span className="font-mono text-[11px] tracking-[0.5px] text-sky border border-sky/30 bg-sky/10 px-2.5 py-1 rounded-[6px] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {loadTestWindow(m.loadTestAt!)}
                  </span>
                )}
              </div>

              <div className="mt-auto pt-1 flex items-center justify-between font-mono text-[12px] text-ash">
                <span className="flex items-center gap-1.5 truncate">
                  Posted {timeAgo(m.createdAt)}
                  {isLoadTest && m.testersNeeded ? (
                    <>
                      <span className="text-iron">·</span>
                      <Users className="w-3 h-3 shrink-0" />
                      {m.testersNeeded} needed
                    </>
                  ) : null}
                </span>
                <span className="text-chalk/70 group-hover:text-chalk transition-colors duration-150 shrink-0">
                  View →
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
