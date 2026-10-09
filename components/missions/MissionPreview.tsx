"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Eye, Monitor, Smartphone } from "lucide-react"
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
        "mx-auto w-full min-w-0 m-0 bg-surface px-6 py-10",
        // A phone, or the whole screen as a browser window, edge to edge, with
        // the tester page's own 800px column inside it.
        phone ? "max-w-[360px] border border-line rounded-[24px]" : "min-h-full border-0",
      ].join(" ")}
    >
      <div className="max-w-[800px] mx-auto">
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
      </div>
    </fieldset>
  )
}

/**
 * The Preview button beside Publish, and the full-screen preview it opens —
 * same tab, over the form, so the unsaved mission never has to travel
 * anywhere. A native modal <dialog> still: Esc closes it, focus stays inside
 * and returns to the button.
 */
export function PreviewButton({ project }: { project: Project }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mission, setMission] = useState<MissionSnapshot | null>(null)
  const [phone, setPhone] = useState(true)

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form
    if (!form) return
    const snapshot = snapshotOf(form)
    setMission(snapshot)
    // Starts on the device the mission targets; Phone for "both", since most
    // testers are on Android phones.
    setPhone(snapshot.deviceTarget !== "desktop")
    // The page behind keeps its own scrollbar beside the top layer otherwise.
    document.documentElement.style.overflow = "hidden"
    ref.current?.showModal()
  }

  // Leaving the page with the preview open must not leave the next one locked.
  useEffect(() => () => {
    document.documentElement.style.overflow = ""
  }, [])

  const unfinished = mission ? splitSteps(mission.steps).unfinished : []
  const close = () => ref.current?.close()

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
        onClose={() => {
          document.documentElement.style.overflow = ""
          setMission(null)
        }}
        aria-labelledby="mission-preview-title"
        // The whole viewport, and only the canvas below scrolls — the dialog
        // itself never does, so there is one scroll and no nested bars.
        className="fixed inset-0 w-full h-dvh max-w-none max-h-none m-0 p-0 border-0 overflow-hidden bg-surface-raised text-ink"
      >
        {mission && (
          <div className="h-full flex flex-col">
            {/* Builder chrome. Nothing up here is part of what testers see. */}
            <div className="shrink-0 h-16 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-line bg-surface">
              <button
                type="button"
                onClick={close}
                className="h-10 px-3 -ml-3 rounded-[8px] flex items-center gap-2 font-mono text-[13px] text-ink hover:bg-ink/[0.06] transition-colors duration-150"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to editing</span>
                <span className="sm:hidden">Back</span>
              </button>

              <div className="min-w-0 text-center">
                <h2 id="mission-preview-title" className="font-syne font-bold text-[16px] leading-6 text-ink truncate">
                  What testers see
                </h2>
                {/* Without this, an inert Pass button reads as a broken page. */}
                <p className="hidden md:block font-mono text-[12px] leading-4 text-ink-muted">
                  Nothing here is live, and nothing is saved.
                </p>
              </div>

              <div role="group" aria-label="Preview width" className="flex p-1 gap-1 rounded-[8px] border border-line bg-surface-raised">
                {[
                  { value: true, label: "Phone", Icon: Smartphone },
                  { value: false, label: "Desktop", Icon: Monitor },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={phone === value}
                    aria-label={label}
                    onClick={() => setPhone(value)}
                    className={[
                      "h-8 px-2 sm:px-3 rounded-[6px] flex items-center gap-2 font-mono text-[13px] transition-colors duration-150",
                      phone === value ? "bg-surface text-ink border border-ink-muted" : "text-ink-muted hover:text-ink border border-transparent",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={[
                "flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                phone ? "px-2 py-6 sm:px-8 sm:py-8" : "",
              ].join(" ")}
            >
              {unfinished.length > 0 && (
                <p
                  role="status"
                  className={`max-w-[800px] mb-6 font-mono text-[13px] leading-5 text-ink border-l-2 border-info-ink pl-4 ${phone ? "mx-auto" : "mt-6 mx-6 md:mx-auto"}`}
                >
                  {unfinished.length === 1 ? "Step" : "Steps"} {unfinished.join(", ")}{" "}
                  {unfinished.length === 1 ? "isn't" : "aren't"} finished, so{" "}
                  {unfinished.length === 1 ? "it's" : "they're"} left out below. Testers only ever see complete steps.
                </p>
              )}
              <TesterView mission={mission} project={project} phone={phone} />
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
