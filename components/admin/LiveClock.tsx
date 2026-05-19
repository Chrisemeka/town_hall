"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

function pad(n: number) { return n.toString().padStart(2, "0") }

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="bg-graphite border border-iron rounded-[12px] p-5 flex items-center gap-4 min-w-[260px]"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
    >
      <div
        className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: "rgba(232,255,71,0.08)", border: "1px solid rgba(232,255,71,0.3)" }}
      >
        <Clock className="w-5 h-5 text-voltage" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="font-syne font-bold text-[22px] leading-none text-chalk tabular-nums">
          {now
            ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
            : "--:--:--"}
        </p>
        <p className="font-mono text-[12px] text-ash">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </p>
      </div>
    </div>
  )
}
