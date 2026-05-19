"use client"

import { useState, useTransition } from "react"
import { Ban, PauseCircle, RotateCw, AlertTriangle, ShieldCheck } from "lucide-react"
import { suspendUser, banUser, reactivateUser } from "@/actions/admin/users"

type Mode = "idle" | "suspend-prompt" | "ban-prompt" | "reactivate-confirm"
export type ModerationStatus = "active" | "suspended" | "banned"

const MAX_REASON = 500
const DURATIONS = [7, 30, 90] as const

export function UserRowActions({
  userId,
  status,
  role,
}: {
  userId: string
  status: ModerationStatus
  role: string
}) {
  const [mode, setMode] = useState<Mode>("idle")
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState<7 | 30 | 90>(7)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Admins are not moderable from the UI
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ash">
        <ShieldCheck className="w-3 h-3 text-voltage" />
        Admin
      </span>
    )
  }

  function reset() {
    setMode("idle")
    setReason("")
    setError(null)
  }

  function handleSuspend() {
    const trimmed = reason.trim()
    if (trimmed.length < 3) { setError("Reason must be at least 3 characters."); return }
    setError(null)
    startTransition(async () => {
      try {
        await suspendUser(userId, trimmed, duration)
        reset()
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
      }
    })
  }

  function handleBan() {
    const trimmed = reason.trim()
    if (trimmed.length < 3) { setError("Reason must be at least 3 characters."); return }
    setError(null)
    startTransition(async () => {
      try {
        await banUser(userId, trimmed)
        reset()
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
      }
    })
  }

  function handleReactivate() {
    setError(null)
    startTransition(async () => {
      try {
        await reactivateUser(userId)
        reset()
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
        setMode("idle")
      }
    })
  }

  if (mode === "suspend-prompt" || mode === "ban-prompt") {
    const isSuspend = mode === "suspend-prompt"
    return (
      <div className="flex flex-col gap-2 items-end">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          placeholder={isSuspend ? "Why is this user being suspended?" : "Why is this user being banned?"}
          rows={2}
          autoFocus
          disabled={isPending}
          className="w-full md:w-[280px] bg-obsidian border border-iron rounded-[6px] px-2 py-1.5 font-mono text-[12px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none disabled:opacity-40"
        />

        {isSuspend && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-ash mr-1 uppercase tracking-[0.5px]">Duration:</span>
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d as 7 | 30 | 90)}
                disabled={isPending}
                className="h-6 px-2 rounded-[6px] font-mono text-[11px] transition-colors duration-150 disabled:opacity-40"
                style={
                  duration === d
                    ? { background: "rgba(232,255,71,0.12)", color: "#E8FF47", border: "1px solid rgba(232,255,71,0.4)" }
                    : { background: "transparent", color: "#7C7C8A", border: "1px solid #2C2C35" }
                }
              >
                {d}d
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 justify-end flex-wrap">
          {error && (
            <span className="font-mono text-[11px] text-ember truncate max-w-[160px]" title={error}>{error}</span>
          )}
          <span className="font-mono text-[10px] text-ash/60 tabular-nums">
            {reason.trim().length}/{MAX_REASON}
          </span>
          <button
            type="button"
            onClick={isSuspend ? handleSuspend : handleBan}
            disabled={isPending || reason.trim().length < 3}
            className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
            style={
              isSuspend
                ? { background: "#FF8F47", color: "#0E0E10" }
                : { background: "#FF4F4F", color: "#0E0E10" }
            }
          >
            {isPending ? "Working…" : isSuspend ? "Suspend" : "Ban"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] text-ash border border-iron hover:text-chalk transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (mode === "reactivate-confirm") {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[11px] text-ash inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Reactivate?
        </span>
        <button
          type="button"
          onClick={handleReactivate}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: "#E8FF47", color: "#0E0E10" }}
        >
          {isPending ? "Working…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] text-ash border border-iron hover:text-chalk transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === "active") {
    return (
      <div className="flex items-center gap-2 justify-end">
        {error && (
          <span className="font-mono text-[11px] text-ember mr-1 truncate max-w-[140px]" title={error}>{error}</span>
        )}
        <button
          type="button"
          onClick={() => setMode("suspend-prompt")}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          style={{ borderColor: "rgba(255,143,71,0.4)", color: "#FF8F47", background: "transparent" }}
        >
          <PauseCircle className="w-3 h-3" />
          Suspend
        </button>
        <button
          type="button"
          onClick={() => setMode("ban-prompt")}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          style={{ borderColor: "rgba(255,79,79,0.4)", color: "#FF4F4F", background: "transparent" }}
        >
          <Ban className="w-3 h-3" />
          Ban
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {error && (
        <span className="font-mono text-[11px] text-ember mr-1 truncate max-w-[140px]" title={error}>{error}</span>
      )}
      <button
        type="button"
        onClick={() => setMode("reactivate-confirm")}
        disabled={isPending}
        className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        style={{ borderColor: "rgba(122,225,138,0.4)", color: "#7AE18A", background: "rgba(122,225,138,0.05)" }}
      >
        <RotateCw className="w-3 h-3" />
        Reactivate
      </button>
    </div>
  )
}
