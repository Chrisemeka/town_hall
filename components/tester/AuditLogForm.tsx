"use client"

import { useEffect, useRef, useState } from "react"
import { Reorder } from "framer-motion"
import { submitTestResult, type SubmissionFieldErrors } from "@/actions/submissions"
import { Upload, ExternalLink, CheckCircle, X } from "lucide-react"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { compressImage } from "@/lib/image"
import {
  ALLOWED_SCREENSHOT_TYPES,
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  screenshotSchema,
  type TestStep,
} from "@/lib/validation/schemas"
import {
  AuditLogSteps,
  draftFor,
  draftIsComplete,
  entryFieldName,
  firstIncompleteEntry,
  type DraftEntry,
} from "@/components/tester/AuditLogSteps"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"

// Each picked image is paired with its object URL so previews survive reordering
// and each entry has a stable key.
type Shot = { file: File; url: string }

/** Where a half-finished log lives between visits. */
const draftKey = (missionId: string) => `twnhall:audit-log:${missionId}`

export default function AuditLogForm({
  missionId,
  appUrl,
  steps,
}: {
  missionId: string
  appUrl: string | null
  /** Empty for every mission written before test cases existed — see hasSteps. */
  steps: TestStep[]
}) {
  // A mission with no steps has nothing to file against, so it falls back to the
  // comment-and-screenshots shape. Thirteen of the sixteen live missions are
  // that, and without this they would all become untestable.
  const hasSteps = steps.length > 0
  const [entries, setEntries] = useState<DraftEntry[]>(() => draftFor(steps))
  const [unlocked,    setUnlocked]    = useState(false)
  const [feedback,    setFeedback]    = useState("")
  const [shots,       setShots]       = useState<Shot[]>([])
  const [fileErrors,  setFileErrors]  = useState<string[]>([])
  const [commentError, setCommentError] = useState<string | null>(null)
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [isHovered,   setIsHovered]   = useState(false)
  const [isSubmitting,setIsSubmitting]= useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess,   setIsSuccess]   = useState(false)
  // Which step the last submit attempt stopped on, so its card can say so.
  const [errorIndex,  setErrorIndex]  = useState<number | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const focusFirstError = useFocusFirstError()

  // Prompt on reload while the tester has work in progress that hasn't been sent.
  useUnsavedChangesWarning(
    !isSuccess && (feedback.length > 0 || shots.length > 0 || draftStarted(entries)),
  )

  // Restore a half-finished log. A ten-step audit is a long form and losing it
  // to a closed tab loses the tester — localStorage is enough for that, and a
  // server-side draft store would be a feature of its own.
  //
  // Keyed by mission and reconciled against the current steps, so a builder
  // editing the mission cannot resurrect answers to steps that no longer exist.
  useEffect(() => {
    if (!hasSteps) return
    try {
      const saved = window.localStorage.getItem(draftKey(missionId))
      if (!saved) return
      const parsed = JSON.parse(saved) as DraftEntry[]
      const byStep = new Map(parsed.map((e) => [e.step_id, e]))
      setEntries((current) =>
        current.map((entry) => {
          const restored = byStep.get(entry.step_id)
          // Keep the live step text; restore only what the tester typed.
          return restored ? { ...entry, ...restored, step_action: entry.step_action, step_expected: entry.step_expected } : entry
        }),
      )
    } catch {
      // A corrupt or unreadable draft is not worth surfacing — the form still
      // works, it just starts empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hasSteps || isSuccess) return
    try {
      window.localStorage.setItem(draftKey(missionId), JSON.stringify(entries))
    } catch {
      // Private browsing, or storage full. Losing the draft is survivable;
      // failing the form over it is not.
    }
  }, [entries, hasSteps, isSuccess, missionId])

  function addFiles(incoming: File[]) {
    const errors: string[] = []
    const accepted: Shot[] = []

    for (const f of incoming) {
      if (shots.length + accepted.length >= MAX_SCREENSHOTS) {
        errors.push(`You can attach up to ${MAX_SCREENSHOTS} screenshots — the rest were skipped.`)
        break
      }
      const parsed = screenshotSchema.safeParse(f)
      if (!parsed.success) {
        errors.push(`${f.name} — ${parsed.error.issues[0]?.message ?? "Invalid file."}`)
        continue
      }
      accepted.push({ file: f, url: URL.createObjectURL(f) })
    }

    if (accepted.length) setShots((prev) => [...prev, ...accepted])
    setFileErrors(errors)
  }

  function removeShot(target: Shot) {
    URL.revokeObjectURL(target.url)
    setShots((prev) => prev.filter((s) => s.url !== target.url))
    setFileErrors([])
    if (fileRef.current) fileRef.current.value = ""
  }

  function applyServerErrors(errors: SubmissionFieldErrors) {
    setCommentError(errors.comment?.[0] ?? null)
    setFileErrors(errors.screenshots ?? [])
    focusFirstError(errors)
  }

  async function handleSubmit() {
    if (isSubmitting) return

    // Client-side validation, and the button is live so that this can run. A
    // button disabled until the form is complete cannot tell anyone what is
    // missing — which was the state this form was in, with three error messages
    // behind a control that never fired them.
    if (hasSteps) {
      const missing = firstIncompleteEntry(entries)
      if (missing) {
        setErrorIndex(missing.index)
        // Named, not "answer every step". On a ten-step log that sentence is
        // the whole problem: it is true and it is useless.
        setSubmitError(`Step ${missing.index + 1} needs an answer.`)
        focusFirstError({ [entryFieldName(missing.index, missing.field)]: true })
        return
      }
      setErrorIndex(undefined)
    }
    // These run in the order the page renders them — steps, screenshots, then
    // the comment box — so the first complaint is always about the first gap a
    // tester would reach by scrolling. Checking screenshots first, as this once
    // did, sent someone who had answered ten steps to the bottom of the page
    // before mentioning the step they had missed.
    if (shots.length === 0) {
      setFileErrors(["At least one screenshot is required."])
      focusFirstError({ screenshots: true })
      return
    }
    if (!hasSteps && !feedback.trim()) {
      setCommentError("Tell the builder what you found.")
      focusFirstError({ comment: true })
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setCommentError(null)
    setFileErrors([])
    setErrorIndex(undefined)
    try {
      const compressed = await Promise.all(shots.map((s) => compressImage(s.file)))
      const fd = new FormData()
      fd.append("missionId", missionId)
      fd.append("comment", feedback)
      fd.append("entries", JSON.stringify(hasSteps ? entries : []))
      for (const file of compressed) fd.append("screenshots", file)
      const result = await submitTestResult(fd)
      if (result.success) {
        setIsSuccess(true)
        try {
          window.localStorage.removeItem(draftKey(missionId))
        } catch {
          // Nothing to do — the submission already succeeded.
        }
      } else {
        if (result.fieldErrors) applyServerErrors(result.fieldErrors)
        setSubmitError(result.error)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unexpected error.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 border border-dashed rounded-[12px] text-center px-6"
        style={{ borderColor: "rgba(63,255,162,0.3)" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ background: "rgba(63,255,162,0.1)" }}
        >
          <CheckCircle className="w-6 h-6" style={{ color: "#3FFFA2" }} />
        </div>
        <h3 className="font-syne font-bold text-[24px] text-ink mb-2">Feedback Submitted</h3>
        <p className="font-mono text-[14px] text-ink-muted">
          Thanks for testing — your feedback has been logged.
        </p>
      </div>
    )
  }

  // Complete enough to send. Not a disabled state any more — it drives the
  // hint under the button, so an incomplete form says what it is waiting for
  // instead of presenting a control that silently refuses.
  const isReady =
    shots.length > 0 && (hasSteps ? draftIsComplete(entries) : feedback.trim().length > 0)
  const isFull = shots.length >= MAX_SCREENSHOTS

  const zoneBorder = fileErrors.length
    ? "#FF4F4F"
    : isDragOver
    ? "#E8FF47"
    : isHovered
    ? "rgba(232,255,71,0.4)"
    : "#2C2C35"

  const zoneBg = isDragOver
    ? "rgba(232,255,71,0.06)"
    : isHovered
    ? "rgba(232,255,71,0.03)"
    : "#1A1A1F"

  const acceptAttr = ALLOWED_SCREENSHOT_TYPES.join(",")
  const maxMb = Math.round(MAX_SCREENSHOT_BYTES / (1024 * 1024))

  return (
    <div>
      {/* Open Project in New Tab */}
      <button
        onClick={() => {
          if (appUrl) window.open(appUrl, "_blank", "noopener,noreferrer")
          setUnlocked(true)
        }}
        className={`w-full h-12 rounded-[8px] font-mono font-medium text-[14px] transition-colors duration-150 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          unlocked
            ? "mb-8 border border-line text-ink hover:border-ink-muted"
            : "mb-3 bg-voltage text-obsidian hover:bg-voltage-dark"
        }`}
      >
        {unlocked ? "Open Again in New Tab" : "Open Project in New Tab"}
        <ExternalLink className="w-4 h-4" />
      </button>

      {/*
        The screenshot requirement, said before the tester leaves rather than
        after they come back.

        The whole form below is gated on `unlocked`, so until this button is
        clicked the word "screenshot" appears nowhere on the page. A tester
        learned they needed one only after the journey was over, when the only
        way to get it was to do the journey again.

        Only before unlock: afterwards the form itself says it, and someone
        clicking "Open Again" has already found out.
      */}
      {!unlocked && (
        <p className="font-mono text-[13px] text-ink-muted leading-5 mb-8">
          <span className="text-ink">Screenshot as you go.</span>{" "}
          You&apos;ll need at least one to
          submit, and the whole journey tells the builder more than the last screen does.
        </p>
      )}

      {/* Feedback form — mounted on unlock, not merely faded.
          Keeping it mounted at opacity 0 left the page reserving its full
          height before the tester had opened anything, which the audit log
          made several screens' worth of dead scroll. */}
      {unlocked && (
      <div className="th-fade-in">
        {submitError && (
          <div
            className="mb-6 px-4 py-3 rounded-[8px]"
            style={{ background: "rgba(255,79,79,0.1)", border: "1px solid rgba(255,79,79,0.2)" }}
          >
            <p className="font-mono text-[14px] text-danger-ink">{submitError}</p>
          </div>
        )}

        {hasSteps && (
          <>
            <p
              className="font-mono text-[11px] font-medium uppercase text-accent-ink mb-3"
              style={{ letterSpacing: "1px" }}
            >
              Work through the test case
            </p>
            <p className="font-mono text-[13px] text-ink-muted leading-5 mb-4">
              Each step shows what the builder asked for. Answer them in order.
            </p>
            <div className="mb-8">
              <AuditLogSteps
                entries={entries}
                onChange={setEntries}
                errorIndex={errorIndex}
              />
            </div>
          </>
        )}

        {/* Named for the artefact, not its purpose: a first-time tester read
            "Proof of Visit" and did not know a screenshot was wanted. */}
        <p
          className="font-mono text-[11px] font-medium uppercase text-accent-ink mb-2"
          style={{ letterSpacing: "1px" }}
        >
          Screenshots of Your Test
        </p>
        <p className="font-mono text-[13px] text-ink-muted mb-4 leading-5">
          Upload screenshots from the project — PNG, JPG, or WEBP under {maxMb}&nbsp;MB each, up to{" "}
          {MAX_SCREENSHOTS}. Capture the whole journey, not just the final screen: the more steps you
          show, the more the builder can act on.
        </p>

        {/* Thumbnail strip — drag to reorder, × to remove */}
        {shots.length > 0 && (
          <Reorder.Group
            axis="x"
            values={shots}
            onReorder={setShots}
            className="flex flex-wrap gap-3 mb-4 list-none p-0"
          >
            {shots.map((shot, i) => (
              <Reorder.Item
                key={shot.url}
                value={shot}
                className="relative w-20 h-20 rounded-[8px] overflow-hidden border border-line bg-surface cursor-grab active:cursor-grabbing shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Screenshot ${i + 1}: ${shot.file.name}`}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => removeShot(shot)}
                  aria-label={`Remove ${shot.file.name}`}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-surface/85 border border-line text-ink-muted hover:text-danger-ink hover:border-danger-ink transition-colors duration-150 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-surface/80 font-mono text-[10px] text-ink-muted text-center leading-4">
                  {i + 1}
                </span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Drop zone — hidden once the cap is reached */}
        {!isFull && (
          <div
            // Named for the key the action reports upload errors under, so a
            // server-side screenshot error lands here too.
            id="screenshots"
            // A div with an onClick is not reachable by keyboard, which
            // Design.md §10 names directly. role + tabIndex + the key handler
            // make it a button in every way that matters.
            role="button"
            tabIndex={0}
            aria-label="Add screenshots"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileRef.current?.click()
              }
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              addFiles(Array.from(e.dataTransfer.files))
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              background: zoneBg,
              border: `1px dashed ${zoneBorder}`,
              borderRadius: 12,
              padding: shots.length > 0 ? 20 : 32,
              minHeight: shots.length > 0 ? 88 : 140,
              cursor: "pointer",
              transition: "border-color 150ms ease, background 150ms ease",
            }}
            className="flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <input
              ref={fileRef}
              type="file"
              accept={acceptAttr}
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []))
                e.target.value = ""
              }}
            />
            <Upload className="w-6 h-6 text-ink-muted mb-3" />
            <p className="font-mono text-[13px] text-ink-muted text-center">
              {shots.length > 0 ? "Add more screenshots" : "Drop your screenshots here"}{" "}
              <span className="text-accent-ink">or browse files</span>
            </p>
          </div>
        )}

        {shots.length > 0 && (
          <p className="font-mono text-[12px] text-ink-muted mt-2">
            {shots.length} of {MAX_SCREENSHOTS} attached
            {shots.length > 1 && " · drag a thumbnail to reorder"}
          </p>
        )}

        {fileErrors.map((msg) => (
          <p key={msg} className="font-mono text-[12px] text-danger-ink mt-2">{msg}</p>
        ))}

        {/* YOUR FEEDBACK */}
        <p
          className="font-mono text-[11px] font-medium uppercase text-accent-ink mt-8 mb-3"
          style={{ letterSpacing: "1px" }}
        >
          {hasSteps ? "Anything else?" : "Your Feedback"}
        </p>

        <textarea
          id="comment"
          name="comment"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value)
            if (commentError) setCommentError(null)
          }}
          placeholder={hasSteps ? "Anything that did not fit the steps above." : "Share what you found — be specific and constructive."}
          className={[
            "w-full bg-surface border rounded-[8px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150 resize-none",
            commentError ? "border-danger-ink" : "border-line focus:border-accent-ink",
          ].join(" ")}
          style={{ minHeight: 160 }}
        />
        <div className="flex items-center justify-between mt-2 mb-8 gap-3">
          {commentError ? (
            <p className="font-mono text-[12px] text-danger-ink">{commentError}</p>
          ) : (
            <p className="font-mono text-[12px] text-ink-muted">
              {hasSteps
                ? "Optional — anything that did not fit the steps above."
                : "Be specific and constructive."}
            </p>
          )}
          <span className="font-mono text-[12px] text-ink-muted shrink-0">{feedback.length} chars</span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 mt-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-describedby={isReady ? undefined : "submit-hint"}
            className="h-12 px-6 self-start bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {isSubmitting ? "Submitting…" : "Submit Feedback"}
          </button>
          {!isReady && (
            <p id="submit-hint" className="font-mono text-[12px] text-ink-muted">
              {hasSteps && !draftIsComplete(entries)
                ? "Answer every step and attach a screenshot to submit."
                : "Attach at least one screenshot to submit."}
            </p>
          )}
          {/* The Save Draft button that used to sit beside Submit was the only
              thing telling a tester their work was kept. It never kept it — it
              wrote the comment box alone to a localStorage key nothing reads —
              but the reassurance was real, and the auto-save above it
              accidentally implied is real too. So it survives as a sentence.
              "On this device" because that is the truth: nothing follows a
              tester to another machine. */}
          <p className="font-mono text-[12px] text-ink-muted">
            Your answers save on this device as you go.
          </p>
        </div>
      </div>
      )}
    </div>
  )
}

/** Whether the tester has answered anything yet. */
function draftStarted(entries: DraftEntry[]): boolean {
  return entries.some(
    (e) => e.status !== "" || e.actual_result.trim() !== "" || e.issue_summary.trim() !== "",
  )
}
