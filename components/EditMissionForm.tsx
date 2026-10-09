"use client"

import { useState, useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { updateMission } from "@/actions/missions"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { TestCaseEditor } from "@/components/missions/TestCaseEditor"
import { MissionNotes } from "@/components/missions/MissionNotes"
import { PreviewButton } from "@/components/missions/MissionPreview"
import {
  MISSION_TITLE_MAX,
  updateMissionSchema,
  toPathErrors,
  type TestStep,
} from "@/lib/validation/schemas"

export default function EditMissionForm({
  missionId,
  projectId,
  project,
  initialTitle,
  initialDescription,
  initialCategory = "",
  initialDeviceTarget = "both",
  initialSteps,
  initialTemplateId = null,
  isActive,
  allowance,
}: {
  missionId: string
  projectId: string
  /** What the preview's project card shows — the tester page's own fields. */
  project: { name: string; app_url: string | null; description: string | null }
  initialTitle: string
  initialDescription: string
  initialCategory?: string
  initialDeviceTarget?: string
  /** Already parsed by the page — an unparseable column renders as no steps. */
  initialSteps: TestStep[]
  initialTemplateId?: string | null
  isActive: boolean
  /** What publishing will spend. Drafts only — re-saving a live mission spends nothing. */
  allowance?: React.ReactNode
}) {
  const [state, formAction] = useActionState(updateMission, null)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({
    fallback: banner,
    // The notes live behind a disclosure; a field in a closed section
    // cannot be focused, so open it and the hook retries.
    reveal: (field) => { if (field === "task_description") setShowNotes(true) },
  })
  const [stepsDirty, setStepsDirty] = useState(false)
  // Open when the mission already has notes — a builder opening this form
  // must not think theirs were deleted.
  const [showNotes, setShowNotes] = useState(initialDescription.trim().length > 0)

  useUnsavedChangesWarning(
    title !== initialTitle || description !== initialDescription || stepsDirty,
  )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const fd = new FormData(e.currentTarget, submitter ?? undefined)
    const parsed = updateMissionSchema.safeParse({
      missionId: fd.get("missionId"),
      projectId: fd.get("projectId"),
      title: fd.get("title"),
      task_description: fd.get("task_description"),
      intent: fd.get("intent"),
      category: fd.get("category"),
      device_target: fd.get("device_target"),
      test_steps: fd.get("test_steps"),
    })
    if (!parsed.success) {
      e.preventDefault()
      // Path-keyed, not flattened: a bad step three has to land on step three,
      // and the focus hook resolves those same dotted keys against the step
      // inputs' names.
      const errors = toPathErrors(parsed.error)
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

  // Server errors are flat (top-level fields only); client errors carry the
  // full path, so a per-step message can reach the row that caused it.
  const fieldErrors: Record<string, string[] | undefined> = {
    ...(state?.fieldErrors ?? {}),
    ...clientErrors,
  }

  return (
    <div className="bg-surface-raised border border-line rounded-[16px] p-10">

      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink mb-1">
        Edit Mission
      </h2>
      <p className="font-mono text-[14px] text-ink-muted mb-8">
        For:{" "}
        <Link href={`/dashboard/${projectId}`} className="text-ink hover:underline">
          {project.name}
        </Link>
      </p>

      {state?.error && (
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-danger-ink/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-danger-ink">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="missionId" value={missionId} />
        <input type="hidden" name="projectId" value={projectId} />

        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
            Mission Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={MISSION_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            {...fieldErrorProps("title", fieldErrors.title)}
            className={[
              "h-10 w-full bg-surface border rounded-[8px] px-4 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150",
              fieldErrors.title?.length ? "border-danger-ink" : "border-line focus:border-accent-ink",
            ].join(" ")}
          />
          <div className="flex items-center justify-between gap-3">
            <FieldError field="title" errors={fieldErrors.title} />
            <span className={`font-mono text-[12px] ml-auto ${title.length >= MISSION_TITLE_MAX ? "text-danger-ink" : "text-ink-muted"}`}>
              {title.length} / {MISSION_TITLE_MAX}
            </span>
          </div>
        </div>

        <TestCaseEditor
          initialCategory={initialCategory || null}
          initialDeviceTarget={initialDeviceTarget}
          initialSteps={initialSteps}
          initialTemplateId={initialTemplateId}
          errors={fieldErrors}
          onDirtyChange={setStepsDirty}
        />

        <MissionNotes
          open={showNotes}
          onOpenChange={setShowNotes}
          value={description}
          onChange={setDescription}
          errors={fieldErrors.task_description}
        />

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <PublishButton />
            <PreviewButton project={project} />
            {!isActive && <DraftButton />}
            <Button variant="ghost" size="lg" asChild>
              <Link href={`/dashboard/${projectId}/mission/${missionId}`}>Cancel</Link>
            </Button>
          </div>
          <p className="font-mono text-[12px] text-ink-muted leading-5">
            Publishing puts this mission — and your project — on the Explore feed where testers
            pick it up. Drafts stay private, and a project with no published mission stays hidden.
          </p>
          {!isActive && allowance}
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
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
    >
      {pending ? "Saving…" : "Save & Publish"}
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
      className="h-12 px-6 border border-line text-ink rounded-[8px] font-mono text-[14px] hover:border-ink-muted transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
    >
      Save as Draft
    </button>
  )
}
