"use client"

import { useState } from "react"
import { Edit2, X, Check, Loader2 } from "lucide-react"
import { updateMission } from "@/actions/missions"

interface InlineEditMissionProps {
  mission: {
    id: string
    project_id: string
    title: string
    task_description: string
    is_active: boolean
  }
}

export default function InlineEditMission({ mission }: InlineEditMissionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      await updateMission(null, formData)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing) {
    return (
      <form action={handleSubmit} className="w-full">
        <input type="hidden" name="missionId" value={mission.id} />
        <input type="hidden" name="projectId" value={mission.project_id} />
        <input type="hidden" name="intent" value={mission.is_active ? "publish" : "draft"} />
        <div className="mb-6">
          <input
            type="text"
            name="title"
            defaultValue={mission.title}
            required
            placeholder="Mission Title"
            className="w-full text-3xl font-medium tracking-tight text-on-surface bg-transparent border-b border-outline-variant focus:border-outline outline-none px-0 py-1"
          />
        </div>
        
        <div className="mb-6">
          <textarea
            name="task_description"
            defaultValue={mission.task_description}
            required
            placeholder="Execution Parameters..."
            className="w-full text-sm text-secondary bg-transparent border border-outline-variant focus:border-outline rounded-xl outline-none p-4 min-h-[120px]"
          />
        </div>
        
        <div className="flex items-center gap-2 mb-8">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-4 bg-on-surface text-surface rounded-full flex items-center gap-2 hover:bg-white/90 shadow-sm transition-all font-medium text-sm disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isSubmitting}
            className="h-9 px-4 bg-surface-variant text-on-surface rounded-full flex items-center gap-2 hover:bg-outline-variant/30 transition-all font-medium text-sm"
          >
            <X size={16} /> Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="group relative pr-12">
      <h1 className="text-3xl font-medium tracking-tight text-on-surface mb-6 leading-tight pr-8">{mission.title}</h1>
      
      <div className="mb-8 p-4 bg-surface-variant/50 rounded-xl border border-outline-variant/50">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-secondary uppercase tracking-wider mb-2">
          Execution Parameters
        </h3>
        <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
          {mission.task_description}
        </p>
      </div>

      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-surface-variant text-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-outline-variant/50 hover:text-on-surface"
        title="Edit Mission"
      >
        <Edit2 size={14} />
      </button>
    </div>
  )
}
