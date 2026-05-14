"use client"

import { useState, useActionState } from "react"
import { useFormStatus } from "react-dom"
import { updateProject } from "@/actions/project"
import { Button } from "@/components/ui/Button"
import Link from "next/link"

export default function EditProjectForm({
  projectId,
  initialName,
  initialUrl,
  initialDescription,
}: {
  projectId: string
  initialName: string
  initialUrl: string
  initialDescription: string
}) {
  const [state, formAction] = useActionState(updateProject.bind(null, projectId), null)
  const [name, setName] = useState(initialName)
  const [url, setUrl] = useState(initialUrl)
  const [description, setDescription] = useState(initialDescription)

  return (
    <div className="bg-graphite border border-iron rounded-[16px] p-10">
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-8">
        Edit Project
      </h2>

      {state?.error && (
        <div className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="app_url" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            App URL
          </label>
          <input
            id="app_url"
            name="app_url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.com"
            className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-obsidian border border-iron rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <SaveButton />
          <Button variant="ghost" size="lg" asChild>
            <Link href={`/dashboard/${projectId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  )
}
