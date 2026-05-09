"use client"

import { useState, useActionState } from "react"
import { useFormStatus } from "react-dom"
import { createProject } from "@/actions/project"
import { Button } from "@/components/ui/Button"
import Link from "next/link"

const MAX_SUMMARY = 300

export default function CreateProjectForm() {
  const [state, formAction] = useActionState(createProject, null)
  const [summary, setSummary]   = useState("")
  const [urlError, setUrlError] = useState("")

  const validateUrl = (value: string) => {
    if (!value) { setUrlError(""); return }
    try {
      new URL(value)
      setUrlError("")
    } catch {
      setUrlError("Enter a valid URL — e.g. https://yourapp.com")
    }
  }

  return (
    <div className="bg-graphite border border-iron rounded-[16px] p-10">

      {/* Header */}
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-1">
        Submit a Project
      </h2>
      <p className="font-mono text-[16px] leading-6 text-ash mb-8">
        Tell the community what you've built.
      </p>

      {/* Server error */}
      {state?.error && (
        <div className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">

        {/* Project Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            placeholder="e.g. DevSync CLI"
            className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
          />
        </div>

        {/* Project URL */}
        <div className="flex flex-col gap-2">
          <label htmlFor="app_url" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Project URL
          </label>
          <input
            id="app_url"
            name="app_url"
            type="url"
            required
            placeholder="https://yourapp.com"
            onBlur={(e) => validateUrl(e.target.value)}
            onChange={() => urlError && setUrlError("")}
            className={[
              "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
              urlError ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          {urlError && (
            <p className="font-mono text-[12px] text-ember">{urlError}</p>
          )}
        </div>

        {/* Brief Summary */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Brief Summary
          </label>
          <textarea
            id="description"
            name="description"
            required
            maxLength={MAX_SUMMARY}
            rows={5}
            placeholder="Describe what your project does and who it's for..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full bg-obsidian border border-iron rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none"
          />
          <div className="flex justify-end">
            <span className={`font-mono text-[12px] ${summary.length >= MAX_SUMMARY ? "text-ember" : "text-ash"}`}>
              {summary.length} / {MAX_SUMMARY}
            </span>
          </div>
        </div>

        {/* What Happens Next info box */}
        <div className="bg-obsidian border border-iron rounded-[12px] p-6">
          <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px] mb-4">
            What happens next?
          </p>
          <div className="flex flex-col gap-4">
            {[
              { num: "01", text: "Your project is published to the community feed." },
              { num: "02", text: "Add missions to tell testers exactly what to check." },
              { num: "03", text: "Developers test it and submit feedback + screenshots." },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-4">
                <span className="font-mono text-[12px] font-medium text-voltage shrink-0 w-6">
                  {step.num}
                </span>
                <p className="font-mono text-[13px] text-ash leading-5">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 pt-2">
          <SubmitButton />
          <Button variant="ghost" size="lg" asChild>
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>

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
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      {pending ? "Creating…" : "Create Project"}
    </button>
  )
}
