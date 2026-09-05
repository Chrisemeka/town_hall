"use client"

import { useSyncExternalStore } from "react"
import { Clock } from "lucide-react"

function pad(n: number) { return n.toString().padStart(2, "0") }

/**
 * The wall clock as an external store.
 *
 * A ticking clock is mutable state that lives outside React. Seeding it from a
 * mount effect — `setNow(new Date())` then an interval — renders once with a
 * placeholder, commits, then immediately renders again, which is the cascading
 * render react-hooks/set-state-in-effect flags.
 *
 * One interval is shared by every mounted clock and stops when the last one
 * unmounts, so the tick is not per-instance. getSnapshot has to return a value
 * that only changes when the store does, which is why the timestamp is cached
 * here rather than read fresh on each call — returning a new Date() per call
 * would re-render forever.
 */
let tick = Date.now()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  timer ??= setInterval(() => {
    tick = Date.now()
    for (const listener of listeners) listener()
  }, 1000)

  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => tick
// Null on the server: the server's clock is not the viewer's, so rendering it
// would only hydrate into a mismatch a moment later.
const getServerSnapshot = () => null

export function LiveClock() {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const now = ms === null ? null : new Date(ms)

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
