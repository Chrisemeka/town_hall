"use client"

import { useState, useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { createMission } from "@/actions/missions"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { TestCaseEditor } from "@/components/missions/TestCaseEditor"
import { MissionNotes } from "@/components/missions/MissionNotes"
import {
  MISSION_TITLE_MAX,
  createMissionSchema,
  toPathErrors,
} from "@/lib/validation/schemas"

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
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({
    fallback: banner,
    // The notes live behind a disclosure; a field in a closed section
    // cannot be focused, so open it and the hook retries.
    reveal: (field) => { if (field === "task_description") setShowNotes(true) },
  })
  const [stepsDirty, setStepsDirty] = useState(false)
  // Unchecked by default: a new mission's brief is its test case.
  const [showNotes, setShowNotes] = useState(false)

  useUnsavedChangesWarning(title.length > 0 || description.length > 0 || stepsDirty)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const fd = new FormData(e.currentTarget, submitter ?? undefined)
    const parsed = createMissionSchema.safeParse({
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
        <div ref={banner} className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
          <p className="font-mono text-[14px] text-ember">{state.error}</p>
        </div>
      )}

      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
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
            maxLength={MISSION_TITLE_MAX}
            placeholder="e.g. Test the checkout flow"
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
          initialCategory={null}
          initialDeviceTarget="both"
          initialSteps={[]}
          initialTemplateId={null}
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

        {/* CTAs */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3">
            <PublishButton />
            <DraftButton />
            <Button variant="ghost" size="lg" asChild>
              <Link href={`/dashboard/${projectId}`}>Cancel</Link>
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
      className="h-12 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite"
    >
      Save as Draft
    </button>
  )
}
