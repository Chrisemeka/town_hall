import type { ReactNode } from "react"

/**
 * Label, control, and one line of either an error or a helper — the form field
 * chrome from Design.md §5.2.
 *
 * Shared rather than local to a flow: the verification gate and Settings collect
 * the same fields, and a second copy of these class strings is a second place for
 * them to drift away from §5.2.
 *
 * Error wins over helper when both are present. A field showing "enter a valid
 * phone number" does not also need to be told what a phone number looks like,
 * and stacking both pushes every field below it down by a line.
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
      <label htmlFor={htmlFor} className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
        {label}
      </label>
      {children}
      {error?.length ? (
        <p className="font-mono text-[12px] text-ember">{error[0]}</p>
      ) : helper ? (
        <p className="font-mono text-[12px] text-ash leading-5">{helper}</p>
      ) : null}
    </div>
  )
}

/** The §5.2 input box, in its resting and its errored state. */
export function inputClass(hasError: boolean): string {
  return [
    "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
    hasError ? "border-ember" : "border-iron focus:border-voltage",
  ].join(" ")
}
