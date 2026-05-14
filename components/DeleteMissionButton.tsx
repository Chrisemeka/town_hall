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
      await deleteMission(missionId, projectId)
      // Hard navigation bypasses Next.js router cache, guaranteeing fresh data
      window.location.href = `/dashboard/${projectId}`
    } catch {
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
