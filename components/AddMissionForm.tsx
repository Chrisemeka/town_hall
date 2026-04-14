"use client"

import { createMission } from "@/actions/missions"
import { useFormStatus } from "react-dom"

export default function AddMissionForm({ projectId }: { projectId: string }) {
  return (
    <div className="bg-surface p-8 rounded-2xl border border-outline-variant shadow-sm relative overflow-hidden">
      {/* Subtle depth */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-on-surface opacity-[0.01] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <h3 className="text-xl font-medium text-on-surface mb-6 tracking-tight">New Test Mission</h3>
      
      <form action={createMission} className="flex flex-col gap-6">
        {/* Hidden input to pass the project ID */}
        <input type="hidden" name="projectId" value={projectId} />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-secondary ml-1">Mission Title</label>
          <input
            name="title"
            required
            placeholder="e.g., Test the Onboarding flow"
            className="h-12 px-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-secondary ml-1">Execution Parameters</label>
          <textarea
            name="task_description"
            required
            placeholder="Tell users exactly what to do step-by-step..."
            className="min-h-[120px] p-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50 resize-y"
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
      className="mt-2 h-12 bg-on-surface text-surface rounded-full font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm hover:bg-white/90 text-sm"
    >
      {pending ? "Initializing Protocol..." : "Launch Mission"}
    </button>
  )
}