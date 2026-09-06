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
  type DraftEntry,
} from "@/components/tester/AuditLogSteps"

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
  const fileRef = useRef<HTMLInputElement>(null)

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
  }

  async function handleSubmit() {
    if (isSubmitting) return

    // Client-side validate first so the user gets immediate feedback.
    if (shots.length === 0) {
      setFileErrors(["At least one screenshot is required."])
      return
    }
    if (hasSteps && !draftIsComplete(entries)) {
      setSubmitError("Answer every step before submitting.")
      return
    }
    if (!hasSteps && !feedback.trim()) {
      setCommentError("Tell the builder what you found.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setCommentError(null)
    setFileErrors([])
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
        <h3 className="font-syne font-bold text-[24px] text-chalk mb-2">Feedback Submitted</h3>
        <p className="font-mono text-[14px] text-ash">
          Thanks for testing — your feedback has been logged.
        </p>
      </div>
    )
  }

  const canSubmit =
    shots.length > 0 &&
    !isSubmitting &&
    (hasSteps ? draftIsComplete(entries) : feedback.trim().length > 0)
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
        className={`w-full h-12 rounded-[8px] font-mono font-medium text-[14px] transition-colors duration-150 flex items-center justify-center gap-2 mb-8 ${
          unlocked
            ? "border border-iron text-chalk hover:border-ash"
            : "bg-voltage text-obsidian hover:bg-[#C8E000]"
        }`}
      >
        {unlocked ? "Open Again in New Tab" : "Open Project in New Tab"}
        <ExternalLink className="w-4 h-4" />
      </button>

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
            <p className="font-mono text-[14px] text-ember">{submitError}</p>
          </div>
        )}

        {hasSteps && (
          <>
            <p
              className="font-mono text-[11px] font-medium uppercase text-voltage mb-3"
              style={{ letterSpacing: "1px" }}
            >
              Work through the test case
            </p>
            <p className="font-mono text-[13px] text-ash leading-5 mb-4">
              Each step shows what the builder asked for. Answer them in order.
            </p>
            <div className="mb-8">
              <AuditLogSteps entries={entries} onChange={setEntries} />
            </div>
          </>
        )}

        {/* YOUR FEEDBACK */}
        <p
          className="font-mono text-[11px] font-medium uppercase text-voltage mb-3"
          style={{ letterSpacing: "1px" }}
        >
          {hasSteps ? "Anything else?" : "Your Feedback"}
        </p>

        <textarea
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value)
            if (commentError) setCommentError(null)
          }}
          placeholder={hasSteps ? "Anything that did not fit the steps above." : "Share what you found — be specific and constructive."}
          className={[
            "w-full bg-obsidian border rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150 resize-none",
            commentError ? "border-ember" : "border-iron focus:border-voltage",
          ].join(" ")}
          style={{ minHeight: 160 }}
        />
        <div className="flex items-center justify-between mt-2 mb-8 gap-3">
          {commentError ? (
            <p className="font-mono text-[12px] text-ember">{commentError}</p>
          ) : (
            <p className="font-mono text-[12px] text-ash">
              {hasSteps
                ? "Optional — anything that did not fit the steps above."
                : "Be specific and constructive."}
            </p>
          )}
          <span className="font-mono text-[12px] text-ash shrink-0">{feedback.length} chars</span>
        </div>

        {/* PROOF OF VISIT */}
        <p
          className="font-mono text-[11px] font-medium uppercase text-voltage mb-2"
          style={{ letterSpacing: "1px" }}
        >
          Proof of Visit
        </p>
        <p className="font-mono text-[13px] text-ash mb-4 leading-5">
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
                className="relative w-20 h-20 rounded-[8px] overflow-hidden border border-iron bg-obsidian cursor-grab active:cursor-grabbing shrink-0"
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
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-obsidian/85 border border-iron text-ash hover:text-ember hover:border-ember transition-colors duration-150 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-obsidian/80 font-mono text-[10px] text-ash text-center leading-4">
                  {i + 1}
                </span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Drop zone — hidden once the cap is reached */}
        {!isFull && (
          <div
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
            className="flex flex-col items-center justify-center"
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
            <Upload className="w-6 h-6 text-ash mb-3" />
            <p className="font-mono text-[13px] text-ash text-center">
              {shots.length > 0 ? "Add more screenshots" : "Drop your screenshots here"}{" "}
              <span className="text-voltage">or browse files</span>
            </p>
          </div>
        )}

        {shots.length > 0 && (
          <p className="font-mono text-[12px] text-ash mt-2">
            {shots.length} of {MAX_SCREENSHOTS} attached
            {shots.length > 1 && " · drag a thumbnail to reorder"}
          </p>
        )}

        {fileErrors.map((msg) => (
          <p key={msg} className="font-mono text-[12px] text-ember mt-2">{msg}</p>
        ))}

        {/* CTAs */}
        <div className="flex items-center gap-3 mt-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-[#C8E000] transition-colors duration-150"
            style={!canSubmit ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            {isSubmitting ? "Submitting…" : "Submit Feedback"}
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`draft:${missionId}`, feedback)
            }}
            className="h-12 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150"
          >
            Save Draft
          </button>
        </div>
      </div>
      )}
    </div>
  )
}

/** Whether the tester has typed anything into the log yet. */
function draftStarted(entries: DraftEntry[]): boolean {
  return entries.some(
    (e) => e.status !== "" || e.actual_result.trim() !== "" || e.issue_summary.trim() !== "",
  )
}
