"use client"

import { useState, useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { updateProject } from "@/actions/project"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { PROJECT_CATEGORIES } from "@/lib/vocabulary"
import {
  PROJECT_NAME_MAX,
  PROJECT_SUMMARY_MAX,
  projectSchema,
  toFieldErrors,
  type ProjectInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export default function EditProjectForm({
  projectId,
  initialName,
  initialUrl,
  initialDescription,
  initialCategory,
}: {
  projectId: string
  initialName: string
  initialUrl: string
  initialDescription: string
  /** Null for every project created before categories existed. */
  initialCategory: string | null
}) {
  const [state, formAction] = useActionState(updateProject.bind(null, projectId), null)
  const [name, setName] = useState(initialName)
  const [url, setUrl] = useState(initialUrl)
  const [description, setDescription] = useState(initialDescription)
  // Empty string, not the raw null, so an uncategorised project opens on the
  // placeholder rather than on whichever option happens to be first.
  const [category, setCategory] = useState(initialCategory ?? "")
  const [clientErrors, setClientErrors] = useState<FieldErrors<ProjectInput>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  useUnsavedChangesWarning(
    name !== initialName ||
      url !== initialUrl ||
      description !== initialDescription ||
      category !== (initialCategory ?? ""),
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
    <div className="bg-surface-raised border border-line rounded-[16px] p-10">
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink mb-8">
        Edit Project
      </h2>

      {state?.error && (
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-danger-ink/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-danger-ink">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={PROJECT_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...fieldErrorProps("name", fieldErrors.name)}
            className={[
              "h-10 w-full bg-surface border rounded-[8px] px-4 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150",
              fieldErrors.name?.length ? "border-danger-ink" : "border-line focus:border-accent-ink",
            ].join(" ")}
          />
          <FieldError field="name" errors={fieldErrors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="app_url" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            App URL
          </label>
          <input
            id="app_url"
            name="app_url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.com"
            {...fieldErrorProps("app_url", fieldErrors.app_url)}
            className={[
              "h-10 w-full bg-surface border rounded-[8px] px-4 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150",
              fieldErrors.app_url?.length ? "border-danger-ink" : "border-line focus:border-accent-ink",
            ].join(" ")}
          />
          <FieldError field="app_url" errors={fieldErrors.app_url} />
        </div>

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
            className={[
              "h-10 w-full bg-surface border rounded-[8px] px-4 font-mono text-[14px] text-ink focus:outline-none transition-colors duration-150",
              fieldErrors.category?.length ? "border-danger-ink" : "border-line focus:border-accent-ink",
            ].join(" ")}
          >
            <option value="">Select a category</option>
            {PROJECT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError field="category" errors={fieldErrors.category} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            What is it?
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            {...fieldErrorProps("description", fieldErrors.description)}
            className={[
              "w-full bg-surface border rounded-[8px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150 resize-none",
              fieldErrors.description?.length ? "border-danger-ink" : "border-line focus:border-accent-ink",
            ].join(" ")}
          />
          <div className="flex items-start justify-between gap-3">
            <FieldError field="description" errors={fieldErrors.description} />
            {/* No maxLength on the textarea: a project written before the cap
                dropped to 200 has to be readable and editable, and maxLength
                would leave the builder unable to see what they are trimming. */}
            <span className={`font-mono text-[12px] shrink-0 ${description.length > PROJECT_SUMMARY_MAX ? "text-danger-ink" : "text-ink-muted"}`}>
              {description.length} / {PROJECT_SUMMARY_MAX}
            </span>
          </div>
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
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  )
}
