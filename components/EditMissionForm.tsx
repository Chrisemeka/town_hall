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
import {
  MISSION_TITLE_MAX,
  MISSION_DESCRIPTION_MIN,
  updateMissionSchema,
  toPathErrors,
  type TestStep,
} from "@/lib/validation/schemas"

export default function EditMissionForm({
  missionId,
  projectId,
  projectName,
  initialTitle,
  initialDescription,
  initialCategory = "",
  initialDeviceTarget = "both",
  initialSteps,
  initialTemplateId = null,
  isActive,
}: {
  missionId: string
  projectId: string
  projectName: string
  initialTitle: string
  initialDescription: string
  initialCategory?: string
  initialDeviceTarget?: string
  /** Already parsed by the page — an unparseable column renders as no steps. */
  initialSteps: TestStep[]
  initialTemplateId?: string | null
  isActive: boolean
}) {
  const [state, formAction] = useActionState(updateMission, null)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })
  const [stepsDirty, setStepsDirty] = useState(false)

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
    <div className="bg-graphite border border-iron rounded-[16px] p-10">

      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-1">
        Edit Mission
      </h2>
      <p className="font-mono text-[14px] text-ash mb-8">
        For:{" "}
        <Link href={`/dashboard/${projectId}`} className="text-chalk hover:underline">
          {projectName}
        </Link>
      </p>

      {state?.error && (
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="missionId" value={missionId} />
        <input type="hidden" name="projectId" value={projectId} />

        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
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
              "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
              fieldErrors.title?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          <div className="flex items-center justify-between gap-3">
            <FieldError field="title" errors={fieldErrors.title} />
            <span className={`font-mono text-[12px] ml-auto ${title.length >= MISSION_TITLE_MAX ? "text-ember" : "text-ash"}`}>
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

        <div className="flex flex-col gap-2">
          <label htmlFor="task_description" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
            What to Test
          </label>
          <textarea
            id="task_description"
            name="task_description"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            {...fieldErrorProps("task_description", fieldErrors.task_description)}
            className={[
              "w-full bg-obsidian border rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150 resize-none",
              fieldErrors.task_description?.length ? "border-ember" : "border-iron focus:border-voltage",
            ].join(" ")}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <FieldError field="task_description" errors={fieldErrors.task_description} />
              {!fieldErrors.task_description?.length && (
                <p className={`font-mono text-[12px] ${description.length > 0 && description.length < MISSION_DESCRIPTION_MIN ? "text-voltage" : "text-ash"}`}>
                  {description.length > 0 && description.length < MISSION_DESCRIPTION_MIN
                    ? `${MISSION_DESCRIPTION_MIN - description.length} more characters needed.`
                    : "Be specific — name the screens and the exact steps testers should follow."}
                </p>
              )}
            </div>
            <span className="font-mono text-[12px] text-ash shrink-0">
              {description.length} chars
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <PublishButton />
            {!isActive && <DraftButton />}
            <Button variant="ghost" size="lg" asChild>
              <Link href={`/dashboard/${projectId}/mission/${missionId}`}>Cancel</Link>
            </Button>
          </div>
          <p className="font-mono text-[12px] text-ash leading-5">
            Publishing puts this mission — and your project — on the Explore feed where testers
            pick it up. Drafts stay private, and a project with no published mission stays hidden.
          </p>
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
      className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite"
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
      className="h-12 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite"
    >
      Save as Draft
    </button>
  )
}
