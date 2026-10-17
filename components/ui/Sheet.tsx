"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Menu, X } from "lucide-react"

// The `expanded:` breakpoint. The sheets never render from here up.
const EXPANDED = "(min-width: 840px)"

const ICON_BUTTON =
  "h-12 w-12 shrink-0 inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

// M3 modal navigation drawer: slides in from the trailing edge on open, 300ms
// ease-standard. The transition lives under `open:` so closing is instant, and
// the start offset is motion-safe so reduced motion gets no slide at all.
const SHEET =
  "m-0 ml-auto h-full max-h-full max-w-none rounded-l-[16px] bg-surface p-0 text-ink backdrop:bg-obsidian/60 open:transition-[translate] open:duration-300 open:ease-standard motion-safe:starting:open:translate-x-full" // ponytail: the scrim is literal Obsidian on purpose — dark in both themes; one that follows the theme stops being a scrim.

export type SheetTrigger =
  | { kind: "menu" }
  | { kind: "avatar"; node: ReactNode; title?: string }

/**
 * The sheet below 840px: the public MobileNav and the app's AccountSheet.
 *
 * ponytail: a native <dialog> opened with showModal(), not a hand-rolled sheet.
 * The platform gives the three things that are tedious and easy to get wrong —
 * focus is trapped inside while it is open, Esc closes it, and focus returns to
 * the trigger on close — for no code. `open` state exists only to drive
 * aria-expanded on the trigger; the dialog's own `close` event keeps it honest
 * when Esc or the backdrop closes it without us.
 */
export function Sheet({
  id,
  label,
  openLabel,
  closeLabel,
  trigger,
  width,
  band,
  children,
}: {
  id: string
  /** The dialog's accessible name. */
  label: string
  openLabel: string
  closeLabel: string
  trigger: SheetTrigger
  /** A width utility, e.g. `w-[min(22.5rem,85vw)]`. */
  width: string
  /** Content beside the close button in the sheet's top band. */
  band?: ReactNode
  children: (close: () => void) => ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => ref.current?.close()

  // The wrapper is expanded:hidden, so crossing 840px while open (a tablet
  // rotating, a window widening) hid the dialog but left it modal: the whole
  // page inert under something nobody could see. Close it instead.
  useEffect(() => {
    const mq = window.matchMedia(EXPANDED)
    const onChange = () => {
      if (mq.matches) ref.current?.close()
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  const shape = trigger.kind === "avatar" ? "rounded-full" : "rounded-[8px]"

  return (
    <div className="expanded:hidden">
      <button
        type="button"
        aria-label={openLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        title={trigger.kind === "avatar" ? trigger.title : undefined}
        onClick={() => {
          ref.current?.showModal()
          setOpen(true)
        }}
        className={`${ICON_BUTTON} ${shape}`}
      >
        {trigger.kind === "avatar" ? trigger.node : <Menu size={20} aria-hidden="true" />}
      </button>

      <dialog
        id={id}
        ref={ref}
        onClose={() => setOpen(false)}
        // A tap on the scrim lands on the dialog itself — its content box
        // fills it edge to edge, so anything else is a tap inside.
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
        aria-label={label}
        // A dialog is centred and auto-sized by default; these pin it to the
        // right as a full-height sheet. backdrop:bg-* styles ::backdrop.
        className={`${SHEET} ${width}`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">{band}</div>
            <button type="button" aria-label={closeLabel} onClick={close} className={`${ICON_BUTTON} ${shape}`}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children(close)}
        </div>
      </dialog>
    </div>
  )
}
