"use client"

import { useState, useTransition } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import { deleteSubmission } from "@/actions/admin/submissions"

export function SubmissionRowActions({ submissionId }: { submissionId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteSubmission(submissionId)
      } catch (err: any) {
        setError(err?.message ?? "Delete failed")
        setConfirm(false)
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ember inline-flex items-center gap-1">
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
          onClick={() => setConfirm(false)}
          disabled={isPending}
          className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] text-ash border border-iron hover:text-chalk transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="font-mono text-[11px] text-ember truncate max-w-[180px]" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={isPending}
        className="h-7 px-2.5 rounded-[6px] font-mono text-[11px] inline-flex items-center gap-1.5 border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
        style={{ borderColor: "rgba(255,79,79,0.4)", color: "#FF4F4F", background: "transparent" }}
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
    </div>
  )
}
