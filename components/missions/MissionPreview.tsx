"use client"

import { useRef, useState } from "react"
import { Eye, X } from "lucide-react"
import { MissionBrief } from "@/components/missions/MissionBrief"
import { AuditLogIntro, AuditLogSteps, draftFor } from "@/components/tester/AuditLogSteps"
import { testStepSchema, type TestStep } from "@/lib/validation/schemas"

type Project = { name: string; app_url: string | null; description: string | null }

/** What the mission form holds at the moment Preview is pressed. */
export type MissionSnapshot = {
  title: string
  notes: string
  category: string | null
  deviceTarget: string | null
  /** Straight off the editor's hidden input — may hold half-written steps. */
  steps: unknown
}

/**
 * Reads the mission form as it stands. The form already mirrors everything into
 * named inputs — TestCaseEditor's hidden category / device_target / test_steps
 * and the title and notes fields — so the preview needs no state of its own and
 * the builder never has to save to see it.
 */
function snapshotOf(form: HTMLFormElement): MissionSnapshot {
  const fd = new FormData(form)
  const str = (key: string) => String(fd.get(key) ?? "")
  let steps: unknown = []
  try {
    steps = JSON.parse(str("test_steps") || "[]")
  } catch {
    steps = []
  }
  return {
    title: str("title"),
    notes: str("task_description"),
    category: str("category") || null,
    deviceTarget: str("device_target") || null,
    steps,
  }
}

/**
 * A step a tester can be shown, or its number when it is not finished.
 *
 * A tester never sees a half-written step — publishing refuses one — and
 * TestCaseView would name the whole case unreadable over a single blank field,
 * which is a fault message, not the tester's view. So unfinished steps are
 * named outside the frame and left out of it.
 */
export function splitSteps(steps: unknown): { ready: TestStep[]; unfinished: number[] } {
  const ready: TestStep[] = []
  const unfinished: number[] = []
  if (!Array.isArray(steps)) return { ready, unfinished }
  steps.forEach((step, i) => {
    const parsed = testStepSchema.safeParse(step)
    if (parsed.success) ready.push(parsed.data)
    else unfinished.push(i + 1)
  })
  return { ready, unfinished }
}

/**
 * The tester's mission page, composed from the tester's own components and
 * nothing else — MissionBrief and AuditLogSteps. Never AuditLogForm: it writes
 * localStorage drafts keyed by mission and carries the submit button.
 *
 * Inert and inside a disabled fieldset: nothing in it takes focus or a click,
 * and its textareas, which sit inside the mission form, are never submitted
 * with it.
 */
export function TesterView({
  mission,
  project,
  phone,
}: {
  mission: MissionSnapshot
  project: Project
  phone: boolean
}) {
  const { ready } = splitSteps(mission.steps)
  return (
    <fieldset
      disabled
      inert
      aria-label="Tester preview"
      className={[
        "mx-auto w-full min-w-0 m-0 bg-surface border border-line rounded-[12px] px-6 py-10",
        phone ? "max-w-[360px]" : "max-w-[800px]",
      ].join(" ")}
    >
      <MissionBrief
        title={mission.title}
        project={project}
        notes={mission.notes.trim() ? mission.notes : null}
        category={mission.category}
        deviceTarget={mission.deviceTarget}
        steps={ready}
      />
      {ready.length > 0 && (
        <>
          <AuditLogIntro />
          <AuditLogSteps entries={draftFor(ready)} category={mission.category} onChange={() => {}} />
        </>
      )}
    </fieldset>
  )
}

/** The Preview button beside Publish, and the dialog it opens. */
export function PreviewButton({ project }: { project: Project }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mission, setMission] = useState<MissionSnapshot | null>(null)
  // Only consulted for "both"; mobile is always a phone, desktop never.
  const [phone, setPhone] = useState(true)

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form
    if (!form) return
    setMission(snapshotOf(form))
    ref.current?.showModal()
  }

  const device = mission?.deviceTarget
  const asPhone = device === "mobile" || (device !== "desktop" && phone)
  const unfinished = mission ? splitSteps(mission.steps).unfinished : []

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="h-12 px-6 border border-line text-ink rounded-[8px] font-mono text-[14px] hover:border-ink-muted transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
      >
        <Eye className="w-4 h-4" />
        Preview
      </button>

      <dialog
        ref={ref}
        onClose={() => setMission(null)}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
        aria-labelledby="mission-preview-title"
        // ponytail: the backdrop is a scrim — dark on both themes by design.
        className="w-[calc(100%-16px)] max-w-[880px] max-h-[90vh] p-0 m-auto rounded-[12px] border border-line bg-surface-raised text-ink backdrop:bg-black/60"
      >
        {mission && (
          <div className="flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-line">
              <div className="min-w-0 flex flex-col gap-1">
                <h2 id="mission-preview-title" className="font-syne font-bold text-[20px] leading-7 text-ink">
                  What testers see
                </h2>
                {/* Without this, an inert Pass button reads as a broken page. */}
                <p className="font-mono text-[13px] leading-5 text-ink-muted">
                  A preview of this mission as it stands. Nothing here is live, and nothing is saved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close preview"
                className="w-8 h-8 shrink-0 rounded-[8px] flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-2 sm:p-6 flex flex-col gap-4 overflow-y-auto">
              {/* Builder chrome, outside the frame: the tester sees neither. */}
              {device !== "mobile" && device !== "desktop" && (
                <div role="group" aria-label="Preview width" className="flex gap-2 self-center">
                  {[true, false].map((p) => (
                    <button
                      key={String(p)}
                      type="button"
                      aria-pressed={phone === p}
                      onClick={() => setPhone(p)}
                      className={[
                        "h-8 px-3 rounded-[6px] border font-mono text-[13px] transition-colors duration-150",
                        phone === p
                          ? "border-accent-ink text-accent-ink bg-voltage/5"
                          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink",
                      ].join(" ")}
                    >
                      {p ? "Phone" : "Desktop"}
                    </button>
                  ))}
                </div>
              )}
              {unfinished.length > 0 && (
                <p role="status" className="font-mono text-[13px] leading-5 text-ink border-l-2 border-info-ink pl-4">
                  {unfinished.length === 1 ? "Step" : "Steps"} {unfinished.join(", ")} {unfinished.length === 1 ? "isn't" : "aren't"} finished,
                  so {unfinished.length === 1 ? "it's" : "they're"} left out below. Testers only ever see complete steps.
                </p>
              )}
              <TesterView mission={mission} project={project} phone={asPhone} />
            </div>

            <div className="p-4 sm:p-6 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className="h-10 px-4 border border-line text-ink rounded-[8px] font-mono text-[13px] hover:border-ink-muted transition-colors duration-150"
              >
                Back to editing
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
