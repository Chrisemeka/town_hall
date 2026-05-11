"use client"

import { useState, useActionState } from "react"
import { useFormStatus } from "react-dom"
import { createMission } from "@/actions/missions"
import { Button } from "@/components/ui/Button"
import Link from "next/link"

const MAX_TITLE = 100

export default function AddMissionForm({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const [state, formAction] = useActionState(createMission, null)
  const [title,       setTitle]       = useState("")
  const [description, setDescription] = useState("")

  return (
    <div className="bg-graphite border border-iron rounded-[16px] p-10">

      {/* Header */}
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-1">
        Create a Mission
      </h2>
      <p className="font-mono text-[14px] text-ash mb-8">
        For:{" "}
        <Link
          href={`/dashboard/${projectId}`}
          className="text-chalk hover:underline"
        >
          {projectName}
        </Link>
      </p>

      {/* Server error */}
      {state?.error && (
        <div className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="projectId" value={projectId} />

        {/* Mission Title */}
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Mission Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={MAX_TITLE}
            placeholder="e.g. Test the checkout flow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
          />
          <div className="flex justify-end">
            <span className={`font-mono text-[12px] ${title.length >= MAX_TITLE ? "text-ember" : "text-ash"}`}>
              {title.length} / {MAX_TITLE}
            </span>
          </div>
        </div>

        {/* What to Test */}
        <div className="flex flex-col gap-2">
          <label htmlFor="task_description" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            What to Test
          </label>
          <textarea
            id="task_description"
            name="task_description"
            required
            rows={8}
            placeholder="Describe exactly what you want testers to do and what feedback you're looking for..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-obsidian border border-iron rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none"
          />
          <div className="flex items-start justify-between gap-4">
            <p className={`font-mono text-[12px] ${description.length < 100 && description.length > 0 ? "text-voltage" : "text-ash"}`}>
              {description.length < 100 && description.length > 0
                ? "Be more specific — aim for at least 100 characters."
                : "Be specific. The clearer your instructions, the better feedback you'll receive."}
            </p>
            <span className="font-mono text-[12px] text-ash shrink-0">
              {description.length} chars
            </span>
          </div>
        </div>

        {/* Writing a Good Mission tip box */}
        <div className="bg-obsidian border border-iron rounded-[12px] p-6">
          <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px] mb-4">
            Writing a Good Mission
          </p>
          <div className="flex flex-col gap-3">
            {[
              'Start with a verb: "Navigate to…", "Click…", "Try to…"',
              'Describe the exact flow, not just the feature.',
              'Tell testers what to look for — friction, confusion, broken states.',
            ].map((tip, i) => (
              <p key={i} className="font-mono text-[13px] text-ash leading-5 italic">
                {tip}
              </p>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 pt-2">
          <PublishButton />
          <DraftButton />
          <Button variant="ghost" size="lg" asChild>
            <Link href={`/dashboard/${projectId}`}>Cancel</Link>
          </Button>
        </div>

      </form>
    </div>
  )
}

function PublishButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="intent"
      value="publish"
      disabled={pending}
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      {pending ? "Publishing…" : "Publish Mission"}
    </button>
  )
}

function DraftButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="intent"
      value="draft"
      disabled={pending}
      className="h-12 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      Save as Draft
    </button>
  )
}
