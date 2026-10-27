"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { LoadMore } from "@/components/ui/LoadMore"

export type PagedMission = {
  id: string
  title: string
  project_id: string
  projectName: string
  feedbackCount: number
  status: "active" | "draft"
}

export function MissionListPaged({ missions }: { missions: PagedMission[] }) {
  const [visible, setVisible] = useState(6)
  const paged = missions.slice(0, visible)

  return (
    <div>
      <div className="flex flex-col gap-4">
        {paged.map((mission) => (
          // The whole card is the mission's link: the title's ::after
          // stretches over it. The project name sits above that layer.
          <div
            key={mission.id}
            className="group relative bg-surface-raised border border-line rounded-[12px] px-4 py-4 medium:px-6 medium:py-5 flex flex-col transition-colors duration-150 hover:border-accent-ink/30 active:border-accent-ink shadow-card"
          >
            <Link
              href={`/dashboard/${mission.project_id}`}
              // 48px tall below lg; the negative margins take back the extra
              // 30px (18px of text, 4px below it) so the layout does not move.
              className="relative z-10 min-h-12 -mt-[15px] -mb-[11px] lg:min-h-0 lg:mt-0 lg:mb-1 inline-flex items-center font-mono text-[12px] text-ink-muted hover:text-ink transition-colors duration-150 w-fit"
            >
              {mission.projectName}
            </Link>

            {/* Compact: title (up to two lines), then badge, count and arrow.
                From medium: one row, as on desktop. */}
            <div className="flex flex-col gap-3 medium:flex-row medium:items-center medium:justify-between medium:gap-4">
              <Link
                href={`/dashboard/${mission.project_id}/mission/${mission.id}`}
                className="font-syne font-bold text-[16px] text-ink leading-6 flex-1 min-w-0 max-medium:line-clamp-2 medium:truncate after:absolute after:inset-0 after:rounded-[12px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent-ink"
              >
                {mission.title}
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[12px] text-ink-muted">
                  {mission.feedbackCount} test report{mission.feedbackCount !== 1 ? "s" : ""}
                </span>
                <Badge variant={mission.status} className="max-medium:order-first" />
                {/* Decorative: the title is the link. */}
                <span
                  aria-hidden="true"
                  className="max-medium:ml-auto font-mono text-[13px] text-ink-muted group-hover:text-ink transition-colors duration-150 flex items-center gap-1"
                >
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {missions.length > visible && (
        <div className="flex justify-center mt-10">
          <LoadMore onClick={() => setVisible((v) => v + 6)} />
        </div>
      )}
    </div>
  )
}
