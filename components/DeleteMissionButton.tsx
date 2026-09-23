"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { deleteMission } from "@/actions/missions"

interface DeleteMissionButtonProps {
  missionId: string
  projectId: string
}

export default function DeleteMissionButton({ missionId, projectId }: DeleteMissionButtonProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this draft? This action cannot be undone.")) return
    setIsPending(true)
    try {
      // Server action redirects to the project page on success.
      await deleteMission(missionId, projectId)
    } catch (err) {
      // Re-throw Next.js redirect signals so navigation still happens.
      if (err && typeof err === "object" && "digest" in err &&
          typeof (err as { digest?: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
        throw err
      }
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      // Was written against Material Design vocabulary — surface-variant,
      // error-container, outline-variant, secondary — none of which is a token
      // in this codebase, so every one of those classes compiled to nothing and
      // this button has been rendering unstyled. Design.md §5.1 Destructive.
      className="w-full flex items-center justify-center gap-2 h-12 rounded-[8px] font-mono font-medium text-[14px] tracking-[0.2px] bg-transparent border border-danger-ink text-danger-ink hover:bg-danger-ink hover:text-surface-raised transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      Delete Draft
    </button>
  )
}
