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
      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-medium transition-all bg-surface-variant hover:bg-error-container/20 border border-outline-variant hover:border-error/20 hover:text-error text-secondary disabled:opacity-50"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      Delete Draft
    </button>
  )
}
