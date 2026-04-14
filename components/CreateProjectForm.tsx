"use client"

import { useActionState } from "react"
import { createProject } from "@/actions/project"
import { useFormStatus } from "react-dom"

export default function CreateProjectForm() {
  const [state, formAction] = useActionState(createProject, null)

  return (
    <div className="p-8 lg:p-12 bg-surface rounded-2xl border border-outline-variant shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-on-surface opacity-[0.015] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <header className="mb-10 text-center relative z-10">
        <h1 className="text-3xl font-medium tracking-tight text-on-surface mb-3">Initialize Project</h1>
        <p className="text-sm text-secondary">
          Register your application parameters to begin real-user validation.
        </p>
      </header>

      <form action={formAction} className="space-y-8 relative z-10">
        {state?.error && (
            <div className="p-4 bg-error-container/20 border border-error/20 text-error rounded-xl text-sm font-medium">
            {state.error}
            </div>
        )}
        
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-secondary ml-1">Project Name</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g., Flowchart App"
            required
            className="h-14 px-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="app_url" className="text-xs font-semibold uppercase tracking-wider text-secondary ml-1">Application URL</label>
          <input
            id="app_url"
            name="app_url"
            type="url"
            placeholder="https://your-app.com"
            className="h-14 px-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-secondary ml-1">Project Summary</label>
          <textarea
            id="description"
            name="description"
            placeholder="Briefly describe what your app does..."
            className="min-h-32 p-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50 resize-y"
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 bg-on-surface text-surface rounded-full font-medium text-sm hover:bg-white/90 shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
    >
      {pending ? (
        <div className="h-4 w-4 border-2 border-surface border-t-transparent animate-spin rounded-full" />
      ) : (
        "Create Project"
      )}
    </button>
  )
}