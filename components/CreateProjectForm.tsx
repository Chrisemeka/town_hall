"use client"

import { useState, useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { createProject } from "@/actions/project"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { inputClass, textareaClass } from "@/components/ui/Field"
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
    // Below 600px the form sits on the surface, no card: the frame cost
    // 82px of a 360px screen. From 600px, the card.
    <div id="tour-new-project-form" className="medium:bg-surface-raised medium:border medium:border-line medium:rounded-[16px] medium:p-10">

      {/* Header */}
      <div id="tour-new-project-header">
        <h1 className="font-syne font-bold text-[28px] leading-9 medium:text-[32px] medium:leading-10 lg:text-[36px] lg:leading-[44px] tracking-[-0.5px] text-ink mb-1">
          Submit a Project
        </h1>
        <p className="font-mono text-[16px] leading-6 text-ink-muted mb-8">
          Tell the community what you&apos;ve built.
        </p>
      </div>

      {/* Server error */}
      {state?.error && (
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-danger-ink/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-danger-ink">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5 medium:gap-6" noValidate>

        {/* Project Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
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
            autoCapitalize="words"
            enterKeyHint="next"
            {...fieldErrorProps("name", fieldErrors.name)}
            className={inputClass(!!fieldErrors.name?.length)}
          />
          <FieldError field="name" errors={fieldErrors.name} />
        </div>

        {/* Project URL */}
        <div className="flex flex-col gap-2">
          <label htmlFor="app_url" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            Project URL
          </label>
          <input
            id="app_url"
            name="app_url"
            type="url"
            placeholder="https://yourapp.com"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            {...fieldErrorProps("app_url", fieldErrors.app_url)}
            className={inputClass(!!fieldErrors.app_url?.length)}
          />
          <FieldError field="app_url" errors={fieldErrors.app_url} />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            {...fieldErrorProps("category", fieldErrors.category)}
            className={`${inputClass(!!fieldErrors.category?.length)} cursor-pointer`}
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
            <p className="font-mono text-[12px] text-ink-muted leading-5">
              Testers filter the Explore feed by this.
            </p>
          )}
        </div>

        {/* Brief Summary */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            What is it?
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
            className={textareaClass(!!fieldErrors.description?.length, { resizable: false })}
          />
          <div className="flex items-start justify-between gap-3">
            {fieldErrors.description?.length ? (
              <FieldError field="description" errors={fieldErrors.description} />
            ) : (
              <p className="font-mono text-[12px] text-ink-muted leading-5 min-w-0">
                Testers read this on the Explore feed — say what it does and who it&apos;s for.
              </p>
            )}
            <span className={`font-mono text-[12px] shrink-0 ${summary.length >= PROJECT_SUMMARY_MAX ? "text-danger-ink" : "text-ink-muted"}`}>
              {summary.length} / {PROJECT_SUMMARY_MAX}
            </span>
          </div>
        </div>

        {/* What Happens Next info box */}
        <div id="tour-new-project-next" className="bg-surface border border-line rounded-[12px] p-4 medium:p-6">
          <p className="font-mono text-[12px] font-medium text-accent-ink uppercase tracking-[1px] mb-4">
            What happens next?
          </p>
          <div className="flex flex-col gap-4">
            {[
              { num: "01", text: "Your project is created as a DRAFT — it won't appear on the Explore feed yet." },
              { num: "02", text: "Add at least one test case to publish your project and tell testers what to check." },
              { num: "03", text: "Once live, developers pick up your test cases and submit test reports with screenshots." },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-4">
                <span className="font-mono text-[12px] font-medium text-accent-ink shrink-0 w-6">
                  {step.num}
                </span>
                <p className="font-mono text-[14px] lg:text-[13px] text-ink-muted leading-5">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        {/* Compact: Create on top, Cancel under it, both full width. */}
        <div className="grid grid-cols-1 gap-2 pt-2 medium:flex medium:items-center medium:gap-3">
          <SubmitButton />
          <Button variant="ghost" size="lg" asChild className="w-full medium:w-auto">
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
      className="h-12 w-full medium:w-auto px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface medium:focus-visible:ring-offset-surface-raised"
    >
      {pending ? "Creating…" : "Create Project"}
    </button>
  )
}
