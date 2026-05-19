"use client"

import { useState, useTransition } from "react"
import { Flag, FlagOff, Trash2, AlertTriangle } from "lucide-react"
import { flagProject, unflagProject, removeProject } from "@/actions/admin/projects"

type Mode = "idle" | "flag-prompt" | "delete-confirm"

const MAX_REASON = 500

export function ProjectRowActions({
  projectId,
  isFlagged,
}: {
  projectId: string
  isFlagged: boolean
}) {
  const [mode, setMode] = useState<Mode>("idle")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setMode("idle")
    setReason("")
    setError(null)
  }

  function handleUnflag() {
    setError(null)
    startTransition(async () => {
      try {
        await unflagProject(projectId)
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
      }
    })
  }

  function handleConfirmFlag() {
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError("Reason must be at least 3 characters.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await flagProject(projectId, trimmed)
        reset()
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await removeProject(projectId)
      } catch (err: any) {
        setError(err?.message ?? "Action failed")
        setMode("idle")
      }
    })
  }

  if (mode === "flag-prompt") {
    return (
      <div className="flex flex-col gap-2 items-end">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          placeholder="Why is this project being flagged?"
          rows={2}
          autoFocus
          disabled={isPending}
          className="w-full md:w-[280px] bg-obsidian border border-iron rounded-[6px] px-2 py-1.5 font-mono text-[12px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none disabled:opacity-40"
        />
        <div className="flex items-center gap-2 justify-end">
          {error && (
            <span className="font-mono text-[11px] text-ember truncate max-w-[160px]" title={error}>
              {error}
            </span>
          )}
          <span className="font-mono text-[10px] text-ash/60 tabular-nums">
            {reason.trim().length}/{MAX_REASON}
          </span>
          <button
            type="button"
            onClick={handleConfirmFlag}
            disabled={isPending || reason.trim().length < 3}
            className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: "#FF8F47", color: "#0E0E10" }}
          >
            {isPending ? "Flagging…" : "Flag"}
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

  if (mode === "delete-confirm") {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[11px] text-ember flex items-center gap-1 mr-1">
          <AlertTriangle className="w-3 h-3" />
          Delete?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: "#FF4F4F", color: "#0E0E10" }}
        >
          {isPending ? "Deleting…" : "Yes"}
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

  return (
    <div className="flex items-center gap-2 justify-end">
      {error && (
        <span className="font-mono text-[11px] text-ember mr-2 truncate max-w-[180px]" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={isFlagged ? handleUnflag : () => setMode("flag-prompt")}
        disabled={isPending}
        className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        style={
          isFlagged
            ? { borderColor: "rgba(255,143,71,0.4)", color: "#FF8F47", background: "rgba(255,143,71,0.06)" }
            : { borderColor: "#2C2C35", color: "#A1A1AA", background: "transparent" }
        }
      >
        {isFlagged ? <FlagOff className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
        {isFlagged ? "Unflag" : "Flag"}
      </button>

      <button
        type="button"
        onClick={() => setMode("delete-confirm")}
        disabled={isPending}
        className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        style={{ borderColor: "rgba(255,79,79,0.4)", color: "#FF4F4F", background: "transparent" }}
      >
        <Trash2 className="w-3 h-3" />
        Remove
      </button>
    </div>
  )
}
