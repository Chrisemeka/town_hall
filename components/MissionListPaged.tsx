"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/Badge"

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
          <div
            key={mission.id}
            className="bg-graphite border border-iron rounded-[12px] px-6 py-5 flex flex-col transition-colors duration-150 hover:border-voltage/30"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
          >
            <Link
              href={`/dashboard/${mission.project_id}`}
              className="font-mono text-[12px] text-ash hover:text-chalk transition-colors duration-150 mb-1 w-fit"
            >
              {mission.projectName}
            </Link>

            <div className="flex items-center justify-between gap-4">
              <p className="font-syne font-bold text-[16px] text-chalk leading-6 flex-1 min-w-0 truncate">
                {mission.title}
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[12px] text-ash hidden sm:block">
                  {mission.feedbackCount} feedback{mission.feedbackCount !== 1 ? "s" : ""}
                </span>
                <Badge variant={mission.status} />
                <Link
                  href={`/dashboard/${mission.project_id}`}
                  className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150 flex items-center gap-1"
                  aria-label={`Open mission: ${mission.title}`}
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {missions.length > visible && (
        <div className="flex justify-center mt-10">
          <button
            onClick={() => setVisible((v) => v + 6)}
            className="h-10 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:bg-graphite transition-colors duration-150"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
