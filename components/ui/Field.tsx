import type { ReactNode } from "react"
import { errorId } from "@/lib/focus"

/**
 * Label, control, and one line of either an error or a helper — the form field
 * chrome from Design.md §5.2.
 *
 * Shared rather than local to a flow: the verification gate and Settings collect
 * the same fields, and a second copy of these class strings is a second place for
 * them to drift away from §5.2. It used to have that second copy, in
 * components/setup/chrome.tsx, for exactly as long as there were two token
 * systems — this is the one spelling now.
 *
 * Error wins over helper when both are present. A field showing "enter a valid
 * phone number" does not also need to be told what a phone number looks like,
 * and stacking both pushes every field below it down by a line.
 *
 * The error carries errorId(htmlFor) so the control can point at it with
 * aria-describedby — same convention as components/ui/FieldError, which is the
 * other spelling of this chrome. `htmlFor` therefore has to match the schema key
 * the error arrives under, or the focus hook cannot find the field either.
 */
export function Field({
  label,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string
  htmlFor: string
  error?: string[]
  helper?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
        {label}
      </label>
      {children}
      {error?.length ? (
        <p id={errorId(htmlFor)} className="font-mono text-[12px] text-danger-ink">{error[0]}</p>
      ) : helper ? (
        <p className="font-mono text-[12px] text-ink-muted leading-5">{helper}</p>
      ) : null}
    </div>
  )
}

/** The §5.2 input box, in its resting and its errored state. */
export function inputClass(hasError: boolean): string {
  return [
    "h-10 w-full bg-surface border rounded-[8px] px-4 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150",
    // `line` is 1.19:1 on Bone and 1.40:1 on Obsidian — it fails WCAG 1.4.11's
    // 3:1 for a control's visible boundary on BOTH grounds. It was wrong while
    // the app was dark-only too; nobody had checked. ink-muted is 6.8:1 light
    // and 5.1:1 dark.
    hasError ? "border-danger-ink" : "border-ink-muted focus:border-accent-ink",
  ].join(" ")
}

/** The same box as a textarea: §5.2 gives it 120px of height and 12px/16px padding. */
export function textareaClass(hasError: boolean): string {
  return [
    "min-h-[120px] w-full bg-surface border rounded-[8px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none transition-colors duration-150 resize-y",
    hasError ? "border-danger-ink" : "border-ink-muted focus:border-accent-ink",
  ].join(" ")
}
