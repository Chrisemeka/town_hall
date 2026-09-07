"use client"

import { useState, useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { createProject } from "@/actions/project"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { PROJECT_CATEGORIES } from "@/lib/vocabulary"
import {
  PROJECT_SUMMARY_MAX,
  PROJECT_NAME_MAX,
  projectSchema,
  toFieldErrors,
  type ProjectInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export default function CreateProjectForm() {
  const [state, formAction] = useActionState(createProject, null)
  const [summary, setSummary]   = useState("")
  const [name, setName]         = useState("")
  const [appUrl, setAppUrl]     = useState("")
  const [category, setCategory] = useState("")
  const [clientErrors, setClientErrors] = useState<FieldErrors<ProjectInput>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  useUnsavedChangesWarning(
    name.length > 0 || appUrl.length > 0 || summary.length > 0 || category.length > 0,
  )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const parsed = projectSchema.safeParse({
      name: fd.get("name"),
      app_url: fd.get("app_url"),
      description: fd.get("description"),
      category: fd.get("category"),
    })
    if (!parsed.success) {
      e.preventDefault()
      const errors = toFieldErrors<ProjectInput>(parsed.error)
      setClientErrors(errors)
      focusFirstError(errors)
      return
    }
    setClientErrors({})
  }

  // The other half of the same job: a field error that came back from the
  // action rather than from the parse above. Keyed on the state object, whose
  // identity changes on every return, so a second identical failure moves the
  // user a second time.
  useEffect(() => {
    if (state?.fieldErrors) focusFirstError(state.fieldErrors)
  }, [state, focusFirstError])

  const fieldErrors: FieldErrors<ProjectInput> = {
    ...(state?.fieldErrors ?? {}),
    ...clientErrors,
  }

  return (
    <div id="tour-new-project-form" className="bg-graphite border border-iron rounded-[16px] p-10">

      {/* Header */}
      <div id="tour-new-project-header">
        <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-1">
          Submit a Project
        </h2>
        <p className="font-mono text-[16px] leading-6 text-ash mb-8">
          Tell the community what you&apos;ve built.
        </p>
      </div>

      {/* Server error */}
      {state?.error && (
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>

        {/* Project Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={PROJECT_NAME_MAX}
            placeholder="e.g. DevSync CLI"
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...fieldErrorProps("name", fieldErrors.name)}
            className={[
              "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
              fieldErrors.name?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          <FieldError field="name" errors={fieldErrors.name} />
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
            placeholder="https://yourapp.com"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            {...fieldErrorProps("app_url", fieldErrors.app_url)}
            className={[
              "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
              fieldErrors.app_url?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          <FieldError field="app_url" errors={fieldErrors.app_url} />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            {...fieldErrorProps("category", fieldErrors.category)}
            className={[
              "w-full h-10 bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk focus:outline-none transition-colors duration-150",
              fieldErrors.category?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          >
            <option value="">Select a category</option>
            {PROJECT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldErrors.category?.length ? (
            <FieldError field="category" errors={fieldErrors.category} />
          ) : (
            <p className="font-mono text-[12px] text-ash leading-5">
              Testers filter the Explore feed by this.
            </p>
          )}
        </div>

        {/* Brief Summary */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            What is it? (2 sentences)
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={PROJECT_SUMMARY_MAX}
            rows={4}
            placeholder="e.g. DevSync keeps your dotfiles in sync across machines. It is for developers who switch laptops and keep losing their shell config."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            {...fieldErrorProps("description", fieldErrors.description)}
            className={[
              "w-full bg-obsidian border rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150 resize-none",
              fieldErrors.description?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          <div className="flex items-start justify-between gap-3">
            {fieldErrors.description?.length ? (
              <FieldError field="description" errors={fieldErrors.description} />
            ) : (
              <p className="font-mono text-[12px] text-ash leading-5 min-w-0">
                Testers read this on the Explore feed — say what it does and who it&apos;s for.
              </p>
            )}
            <span className={`font-mono text-[12px] shrink-0 ${summary.length >= PROJECT_SUMMARY_MAX ? "text-ember" : "text-ash"}`}>
              {summary.length} / {PROJECT_SUMMARY_MAX}
            </span>
          </div>
        </div>

        {/* What Happens Next info box */}
        <div id="tour-new-project-next" className="bg-obsidian border border-iron rounded-[12px] p-6">
          <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px] mb-4">
            What happens next?
          </p>
          <div className="flex flex-col gap-4">
            {[
              { num: "01", text: "Your project is created as a DRAFT — it won't appear on the Explore feed yet." },
              { num: "02", text: "Add at least one mission to publish your project and tell testers what to check." },
              { num: "03", text: "Once live, developers pick up your missions and submit feedback with screenshots." },
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
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite"
    >
      {pending ? "Creating…" : "Create Project"}
    </button>
  )
}
