"use client"

import { useRef, useState } from "react"
import { ImagePlus, X } from "lucide-react"
import { ALLOWED_SCREENSHOT_TYPES, screenshotSchema } from "@/lib/validation/schemas"

// Each picked image is paired with its object URL so previews survive
// re-renders and each entry has a stable key.
export type Shot = { file: File; url: string }

/**
 * A screenshot upload control: thumbnails with a remove ×, and one button that
 * opens the picker. Used on a step that did not pass and for the final-result
 * screenshot, so the step form has one copy of this UI. The files live in
 * AuditLogForm's state, never in the localStorage draft — a File is not JSON.
 *
 * Object URLs are revoked on remove here and on unmount by AuditLogForm, not on
 * this control's unmount: switching a step to Pass unmounts it while its files
 * are kept for a switch back.
 */
export function StepScreenshots({
  id,
  label,
  helper,
  shots,
  onChange,
  room,
  errors = [],
}: {
  /** entries.<i>.screenshots or screenshots — the key the action reports errors under. */
  id: string
  label: string
  helper: string
  shots: Shot[]
  onChange: (shots: Shot[]) => void
  /** How many more this control may take: its own cap, or what the report has left. */
  room: number
  /** Server-side errors for this control. */
  errors?: string[]
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useState<string[]>([])

  function addFiles(incoming: File[]) {
    const problems: string[] = []
    const accepted: Shot[] = []
    for (const f of incoming) {
      if (accepted.length >= room) {
        problems.push("No room for more screenshots here — the rest were skipped.")
        break
      }
      const parsed = screenshotSchema.safeParse(f)
      if (!parsed.success) {
        problems.push(`${f.name} — ${parsed.error.issues[0]?.message ?? "Invalid file."}`)
        continue
      }
      accepted.push({ file: f, url: URL.createObjectURL(f) })
    }
    if (accepted.length) onChange([...shots, ...accepted])
    setLocal(problems)
  }

  function remove(target: Shot) {
    URL.revokeObjectURL(target.url)
    onChange(shots.filter((s) => s.url !== target.url))
    setLocal([])
  }

  const messages = [...errors, ...local]

  return (
    // tabIndex -1 so the focus hook can land here when the button is gone (full).
    <div id={room > 0 ? undefined : id} tabIndex={room > 0 ? undefined : -1} className="flex flex-col gap-2 outline-none">
      <span className="font-mono text-[12px] lg:text-[11px] text-ink-muted uppercase tracking-[0.5px]">{label}</span>

      {shots.length > 0 && (
        <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
          {shots.map((shot, i) => (
            <li key={shot.url} className="relative w-20 h-20 rounded-[8px] overflow-hidden border border-line bg-surface shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt={`Screenshot ${i + 1}: ${shot.file.name}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(shot)}
                aria-label={`Remove ${shot.file.name}`}
                // A 48px target around the 20px circle, inside the thumbnail.
                className="group/remove absolute top-0 right-0 w-12 h-12 flex items-start justify-end p-1"
              >
                <span className="w-5 h-5 rounded-full bg-surface/85 border border-line text-ink-muted group-hover/remove:text-danger-ink group-hover/remove:border-danger-ink transition-colors duration-150 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <button
          id={id}
          type="button"
          onClick={() => fileRef.current?.click()}
          className={[
            "self-start h-12 px-4 rounded-[8px] border font-mono text-[14px] lg:text-[13px] text-ink inline-flex items-center gap-2 hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
            messages.length ? "border-danger-ink" : "border-ink-muted",
          ].join(" ")}
        >
          <ImagePlus className="w-4 h-4" aria-hidden="true" />
          {shots.length ? "Add another screenshot" : "Add a screenshot"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_SCREENSHOT_TYPES.join(",")}
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />

      {/* The one real defence tester anonymity has: we don't share a tester's
          name with builders, but a screenshot can show it anyway. Never
          "anonymous" — that is a guarantee screenshots break. */}
      <span className="font-mono text-[12px] lg:text-[11px] text-ink-muted leading-5">{helper}</span>

      {messages.map((msg) => (
        <p key={msg} className="font-mono text-[12px] text-danger-ink">{msg}</p>
      ))}
    </div>
  )
}
