"use client"

import { useState } from "react"
import { Globe, Package, Edit2, X, Check, Loader2 } from "lucide-react"
import { updateProject } from "@/actions/project"

interface InlineEditProjectProps {
  project: {
    id: string
    name: string
    app_url: string | null
    description: string | null
  }
}

export default function InlineEditProject({ project }: InlineEditProjectProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      await updateProject(project.id, formData)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing) {
    return (
      <form action={handleSubmit} className="w-full">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center border border-outline-variant shrink-0">
            <Package className="text-secondary" size={24} />
          </div>
          <div className="flex-1 max-w-md">
            <input
              type="text"
              name="name"
              defaultValue={project.name}
              required
              placeholder="Project Name"
              className="w-full text-4xl lg:text-5xl font-medium tracking-tight text-on-surface bg-transparent border-b border-outline-variant focus:border-outline outline-none px-0 py-1"
            />
          </div>
        </div>
        
        <div className="mb-4">
            <input
              type="url"
              name="app_url"
              defaultValue={project.app_url || ""}
              placeholder="https://your-app.com"
              className="w-full max-w-md text-sm font-medium text-secondary bg-transparent border-b border-outline-variant focus:border-outline outline-none px-0 py-1"
            />
        </div>

        <div className="mb-6">
            <textarea
              name="description"
              defaultValue={project.description || ""}
              placeholder="Project Description"
              className="w-full max-w-2xl text-sm text-secondary bg-transparent border border-outline-variant focus:border-outline rounded-xl outline-none p-3 min-h-[80px]"
            />
        </div>
        
        <div className="flex items-center gap-2">
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
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center border border-outline-variant shrink-0">
          <Package className="text-secondary" size={24} />
        </div>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-on-surface">{project.name}</h1>
      </div>
      
      {project.app_url && (
        <a href={project.app_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-secondary hover:text-on-surface flex items-center gap-2 transition-colors mb-4 inline-flex">
          <Globe size={16} /> {project.app_url}
        </a>
      )}

      {project.description && (
        <p className="text-sm text-secondary max-w-2xl leading-relaxed">
          {project.description}
        </p>
      )}

      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-2 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-surface-variant text-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-outline-variant/50 hover:text-on-surface"
        title="Edit Project"
      >
        <Edit2 size={14} />
      </button>
    </div>
  )
}
