"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export type FeedbackEntry = {
  id: string
  missionId: string
  missionTitle: string
  projectId: string
  projectName: string
  tester_comment: string
  screenshot_url: string | null
  created_at: string
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function FeedbackListPaged({ items }: { items: FeedbackEntry[] }) {
  const [visible, setVisible] = useState(6)
  const paged = items.slice(0, visible)

  /* group visible items by mission, preserving encounter order */
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, { title: string; projectId: string; projectName: string; entries: FeedbackEntry[] }>()
    for (const item of paged) {
      if (!map.has(item.missionId)) {
        order.push(item.missionId)
        map.set(item.missionId, {
          title:       item.missionTitle,
          projectId:   item.projectId,
          projectName: item.projectName,
          entries:     [],
        })
      }
      map.get(item.missionId)!.entries.push(item)
    }
    return order.map((id) => ({ missionId: id, ...map.get(id)! }))
  }, [paged])

  return (
    <div>
      <div className="flex flex-col gap-12">
        {groups.map((group) => (
          <div key={group.missionId}>
            <div className="mb-5">
              <Link
                href={`/dashboard/${group.projectId}`}
                className="font-mono text-[12px] text-ash hover:text-chalk transition-colors duration-150 block mb-1"
              >
                {group.projectName}
              </Link>
              <h5 className="font-syne font-bold text-[18px] text-chalk">{group.title}</h5>
            </div>

            <div className="flex flex-col gap-4">
              {group.entries.map((item, i) => (
                <Link
                  key={item.id}
                  href={`/dashboard/${item.projectId}/mission/${item.missionId}`}
                  className="group block border-l-[3px] border-iron pl-4 hover:border-voltage transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[12px] text-ash">
                      Developer #{(i + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[12px] text-ash/40">·</span>
                    <span className="font-mono text-[12px] text-ash/60">{relTime(item.created_at)}</span>
                  </div>

                  <p className="font-mono text-[14px] text-chalk leading-5 line-clamp-3">
                    {item.tester_comment}
                  </p>

                  <span className="mt-2 inline-flex items-center gap-1 font-mono text-[12px] text-ash group-hover:text-voltage transition-colors duration-150">
                    Read full feedback
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {items.length > visible && (
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
